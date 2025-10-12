import { getDb } from '../db';
import { rateLimitUsage, virtualKeys } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Rate Limiting Service
 * Implements sliding window rate limiting for virtual keys
 */

interface RateLimitResult {
  allowed: boolean;
  remaining: {
    requests: number | null;
    tokens: number | null;
  };
  resetAt?: Date;
}

/**
 * Get the start of the current time window (1 minute buckets)
 */
function getWindowStart(): Date {
  const now = new Date();
  now.setSeconds(0, 0);
  return now;
}

/**
 * Check if a request is allowed under rate limits
 * @param virtualKeyId - The virtual key ID
 * @param estimatedTokens - Estimated tokens for this request (default: 0)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  virtualKeyId: string,
  estimatedTokens: number = 0
): Promise<RateLimitResult> {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    // Get virtual key configuration
    const virtualKey = await db
      .select()
      .from(virtualKeys)
      .where(eq(virtualKeys.id, virtualKeyId))
      .get();
    
    if (!virtualKey) {
      console.error(`[${timestamp}] [RateLimitService] [ERROR] Virtual key not found: ${virtualKeyId}`);
      return {
        allowed: false,
        remaining: { requests: null, tokens: null },
      };
    }
    
    // If no limits are set, allow the request
    if (!virtualKey.rateLimitRpm && !virtualKey.rateLimitTpm) {
      return {
        allowed: true,
        remaining: { requests: null, tokens: null },
      };
    }
    
    const windowStart = getWindowStart();
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    
    // Get usage in the current window
    const usageRecords = await db
      .select()
      .from(rateLimitUsage)
      .where(
        and(
          eq(rateLimitUsage.virtualKeyId, virtualKeyId),
          gte(rateLimitUsage.windowStart, oneMinuteAgo)
        )
      );
    
    // Calculate total usage in the sliding window
    let totalRequests = 0;
    let totalTokens = 0;
    
    for (const record of usageRecords) {
      totalRequests += record.requestsCount;
      totalTokens += record.tokensCount;
    }
    
    // Check request limit
    if (virtualKey.rateLimitRpm && totalRequests >= virtualKey.rateLimitRpm) {
      console.warn(
        `[${timestamp}] [RateLimitService] [WARN] Request rate limit exceeded for key ${virtualKey.name}: ${totalRequests}/${virtualKey.rateLimitRpm}`
      );
      return {
        allowed: false,
        remaining: {
          requests: 0,
          tokens: virtualKey.rateLimitTpm ? Math.max(0, virtualKey.rateLimitTpm - totalTokens) : null,
        },
        resetAt: new Date(Date.now() + 60 * 1000),
      };
    }
    
    // Check token limit
    if (virtualKey.rateLimitTpm && totalTokens + estimatedTokens > virtualKey.rateLimitTpm) {
      console.warn(
        `[${timestamp}] [RateLimitService] [WARN] Token rate limit exceeded for key ${virtualKey.name}: ${totalTokens + estimatedTokens}/${virtualKey.rateLimitTpm}`
      );
      return {
        allowed: false,
        remaining: {
          requests: virtualKey.rateLimitRpm ? Math.max(0, virtualKey.rateLimitRpm - totalRequests) : null,
          tokens: 0,
        },
        resetAt: new Date(Date.now() + 60 * 1000),
      };
    }
    
    // Allow the request
    return {
      allowed: true,
      remaining: {
        requests: virtualKey.rateLimitRpm ? virtualKey.rateLimitRpm - totalRequests - 1 : null,
        tokens: virtualKey.rateLimitTpm ? virtualKey.rateLimitTpm - totalTokens - estimatedTokens : null,
      },
    };
  } catch (error: any) {
    console.error(`[${timestamp}] [RateLimitService] [ERROR] Rate limit check failed:`, error.message);
    // On error, allow the request (fail open)
    return {
      allowed: true,
      remaining: { requests: null, tokens: null },
    };
  }
}

/**
 * Record usage for rate limiting
 * @param virtualKeyId - The virtual key ID
 * @param tokensUsed - Number of tokens used
 */
export async function recordUsage(virtualKeyId: string, tokensUsed: number = 0): Promise<void> {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const windowStart = getWindowStart();
    
    // Check if record exists for this window
    const existing = await db
      .select()
      .from(rateLimitUsage)
      .where(
        and(
          eq(rateLimitUsage.virtualKeyId, virtualKeyId),
          eq(rateLimitUsage.windowStart, windowStart)
        )
      )
      .get();
    
    if (existing) {
      // Update existing record
      await db
        .update(rateLimitUsage)
        .set({
          requestsCount: existing.requestsCount + 1,
          tokensCount: existing.tokensCount + tokensUsed,
        })
        .where(eq(rateLimitUsage.id, existing.id));
    } else {
      // Insert new record
      await db.insert(rateLimitUsage).values({
        virtualKeyId,
        windowStart,
        requestsCount: 1,
        tokensCount: tokensUsed,
      });
    }
  } catch (error: any) {
    console.error(`[${timestamp}] [RateLimitService] [ERROR] Failed to record usage:`, error.message);
    // Don't throw - this is non-critical
  }
}

/**
 * Clean up old rate limit records (older than 24 hours)
 */
export async function cleanupOldRecords(): Promise<void> {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const result = await db
      .delete(rateLimitUsage)
      .where(gte(rateLimitUsage.createdAt, oneDayAgo));
    
    console.log(`[${timestamp}] [RateLimitService] [INFO] Cleaned up old rate limit records`);
  } catch (error: any) {
    console.error(`[${timestamp}] [RateLimitService] [ERROR] Cleanup failed:`, error.message);
  }
}

/**
 * Get current usage for a virtual key
 */
export async function getCurrentUsage(virtualKeyId: string): Promise<{
  requests: number;
  tokens: number;
}> {
  const db = getDb();
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
  
  const usageRecords = await db
    .select()
    .from(rateLimitUsage)
    .where(
      and(
        eq(rateLimitUsage.virtualKeyId, virtualKeyId),
        gte(rateLimitUsage.windowStart, oneMinuteAgo)
      )
    );
  
  let totalRequests = 0;
  let totalTokens = 0;
  
  for (const record of usageRecords) {
    totalRequests += record.requestsCount;
    totalTokens += record.tokensCount;
  }
  
  return { requests: totalRequests, tokens: totalTokens };
}


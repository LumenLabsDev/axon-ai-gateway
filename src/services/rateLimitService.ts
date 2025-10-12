import { getDb } from '../db';
import { rateLimitUsage, apiKeys } from '../db/schema';
import { eq, and, gte } from 'drizzle-orm';

/**
 * Rate Limiting Service
 * Implements sliding window rate limiting for API keys
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
 * @param apiKeyId - The API key ID
 * @param estimatedTokens - Estimated tokens for this request (default: 0)
 * @returns Rate limit result
 */
export async function checkRateLimit(
  apiKeyId: string,
  estimatedTokens: number = 0
): Promise<RateLimitResult> {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    // Get API key configuration
    const apiKey = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .get();
    
    if (!apiKey) {
      console.error(`[${timestamp}] [RateLimitService] [ERROR] API key not found: ${apiKeyId}`);
      return {
        allowed: false,
        remaining: { requests: null, tokens: null },
      };
    }
    
    // If no limits are set, allow the request
    if (!apiKey.rateLimitRpm && !apiKey.rateLimitTpm) {
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
          eq(rateLimitUsage.apiKeyId, apiKeyId),
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
    if (apiKey.rateLimitRpm && totalRequests >= apiKey.rateLimitRpm) {
      console.warn(
        `[${timestamp}] [RateLimitService] [WARN] Request rate limit exceeded for key ${apiKey.name}: ${totalRequests}/${apiKey.rateLimitRpm}`
      );
      return {
        allowed: false,
        remaining: {
          requests: 0,
          tokens: apiKey.rateLimitTpm ? Math.max(0, apiKey.rateLimitTpm - totalTokens) : null,
        },
        resetAt: new Date(Date.now() + 60 * 1000),
      };
    }
    
    // Check token limit
    if (apiKey.rateLimitTpm && totalTokens + estimatedTokens > apiKey.rateLimitTpm) {
      console.warn(
        `[${timestamp}] [RateLimitService] [WARN] Token rate limit exceeded for key ${apiKey.name}: ${totalTokens + estimatedTokens}/${apiKey.rateLimitTpm}`
      );
      return {
        allowed: false,
        remaining: {
          requests: apiKey.rateLimitRpm ? Math.max(0, apiKey.rateLimitRpm - totalRequests) : null,
          tokens: 0,
        },
        resetAt: new Date(Date.now() + 60 * 1000),
      };
    }
    
    // Allow the request
    return {
      allowed: true,
      remaining: {
        requests: apiKey.rateLimitRpm ? apiKey.rateLimitRpm - totalRequests - 1 : null,
        tokens: apiKey.rateLimitTpm ? apiKey.rateLimitTpm - totalTokens - estimatedTokens : null,
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
 * @param apiKeyId - The API key ID
 * @param tokensUsed - Number of tokens used
 */
export async function recordUsage(apiKeyId: string, tokensUsed: number = 0): Promise<void> {
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
          eq(rateLimitUsage.apiKeyId, apiKeyId),
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
        apiKeyId,
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
 * Get current usage for an API key
 */
export async function getCurrentUsage(apiKeyId: string): Promise<{
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
        eq(rateLimitUsage.apiKeyId, apiKeyId),
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


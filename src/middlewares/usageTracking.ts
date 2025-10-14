import { Context, Next } from 'hono';
import { recordUsage } from '../services/rateLimitService';
import { getDb } from '../db';
import { requestLogs } from '../db/schema';

/**
 * Usage Tracking Middleware
 * Records API request usage for analytics and rate limiting
 * Tracks request counts, token usage, models, status codes, and response times
 */
export async function usageTracking(c: Context, next: Next) {
  const timestamp = new Date().toISOString();
  const startTime = Date.now();
  
  // Continue with request processing first
  await next();
  
  // Calculate response time
  const responseTime = Date.now() - startTime;
  
  // After request completes, track usage
  try {
    const virtualKey = c.get('virtualKey');
    const workspace = c.get('workspace');
    const providerKey = c.get('providerKey');
    
    // Only track if virtual key is present (authenticated requests)
    if (!virtualKey || !workspace) {
      return;
    }
    
    // Extract request details
    const method = c.req.method;
    const endpoint = new URL(c.req.url).pathname;
    const statusCode = c.res.status;
    
    // Extract token usage and model from response
    let tokensUsed = 0;
    let model: string | undefined;
    
    try {
      // Check if response is JSON and contains usage information
      const contentType = c.res.headers.get('content-type');
      
      if (contentType?.includes('application/json') && !c.res.body) {
        // Response body already consumed, skip extraction
      } else if (contentType?.includes('application/json')) {
        // Clone response to read body without consuming it
        const responseClone = c.res.clone();
        const responseBody = await responseClone.json() as any;
        
        // Extract model
        if (responseBody?.model) {
          model = responseBody.model;
        }
        
        // Extract tokens based on response format
        if (responseBody?.usage) {
          // OpenAI format: usage.total_tokens
          if (typeof responseBody.usage.total_tokens === 'number') {
            tokensUsed = responseBody.usage.total_tokens;
          }
          // Anthropic format: usage.input_tokens + usage.output_tokens
          else if (
            typeof responseBody.usage.input_tokens === 'number' &&
            typeof responseBody.usage.output_tokens === 'number'
          ) {
            tokensUsed = responseBody.usage.input_tokens + responseBody.usage.output_tokens;
          }
        }
      }
    } catch (error: any) {
      // Failed to extract details, but still record the request
      console.warn(
        `[${timestamp}] [UsageTracking] [WARN] Failed to extract response details: ${error.message}`
      );
    }
    
    // If model not in response, try to extract from request
    if (!model) {
      try {
        const requestClone = c.req.raw.clone();
        const requestBody = await requestClone.json() as any;
        if (requestBody?.model) {
          model = requestBody.model;
        }
      } catch {
        // Request body not JSON or already consumed
      }
    }
    
    // Record in rate limit table for rate limiting (fire and forget)
    recordUsage(virtualKey.id, tokensUsed).catch((error: any) => {
      console.error(
        `[${timestamp}] [UsageTracking] [ERROR] Failed to record rate limit usage: ${error.message}`
      );
    });
    
    // Record in request logs for analytics
    try {
      const db = getDb();
      await db.insert(requestLogs).values({
        workspaceId: workspace.id,
        virtualKeyId: virtualKey.id,
        model: model || null,
        provider: providerKey?.provider || null,
        endpoint,
        method,
        statusCode,
        tokensUsed,
        responseTime,
      });
      
      console.log(
        `[${timestamp}] [UsageTracking] [INFO] Logged request: workspace=${workspace.id} virtualKey=${virtualKey.name} model=${model || 'unknown'} status=${statusCode} tokens=${tokensUsed} responseTime=${responseTime}ms`
      );
    } catch (error: any) {
      console.error(
        `[${timestamp}] [UsageTracking] [ERROR] Failed to log request: ${error.message}`
      );
    }
  } catch (error: any) {
    // Log error but don't fail the request
    console.error(
      `[${timestamp}] [UsageTracking] [ERROR] Usage tracking error: ${error.message}`
    );
  }
}


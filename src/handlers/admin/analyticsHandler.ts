import { Context } from 'hono';
import { getDb } from '../../db';
import { virtualKeys, requestLogs, providerKeys, prompts } from '../../db/schema';
import { eq, and, gte, count, sum, sql, avg } from 'drizzle-orm';

/**
 * Get analytics data for a workspace
 * GET /v1/admin/analytics?timeRange=24h
 */
export async function getAnalytics(c: Context) {
  const db = getDb();
  const workspace = c.get('workspace');
  
  if (!workspace) {
    return c.json(
      {
        status: 'failure',
        message: 'Workspace context required',
      },
      400
    );
  }

  // Parse time range from query params (default 24h)
  const timeRangeParam = c.req.query('timeRange') || '24h';
  const timeRange = parseTimeRange(timeRangeParam);
  const startTime = new Date(Date.now() - timeRange);

  try {
    // Get total virtual keys count
    const virtualKeysResult = await db
      .select({ count: count() })
      .from(virtualKeys)
      .where(eq(virtualKeys.workspaceId, workspace.id));
    
    const totalVirtualKeys = virtualKeysResult[0]?.count || 0;

    // Get total provider keys count
    const providerKeysResult = await db
      .select({ count: count() })
      .from(providerKeys)
      .where(eq(providerKeys.workspaceId, workspace.id));
    
    const totalProviderKeys = providerKeysResult[0]?.count || 0;

    // Get total prompts count
    const promptsResult = await db
      .select({ count: count() })
      .from(prompts)
      .where(eq(prompts.workspaceId, workspace.id));
    
    const totalPrompts = promptsResult[0]?.count || 0;

    // Get workspace virtual keys for rate limit queries
    const workspaceVirtualKeys = await db
      .select({ id: virtualKeys.id })
      .from(virtualKeys)
      .where(eq(virtualKeys.workspaceId, workspace.id));
    
    const virtualKeyIds = workspaceVirtualKeys.map(k => k.id);

    if (virtualKeyIds.length === 0) {
      // No virtual keys, return empty analytics
      return c.json({
        status: 'success',
        data: {
          totalRequests: 0,
          totalTokens: 0,
          successRate: 0,
          avgResponseTime: 0,
          requestsByVirtualKey: {},
          requestsByTimeWindow: [],
          topModels: [],
          resourceCounts: {
            virtualKeys: totalVirtualKeys,
            providerKeys: totalProviderKeys,
            prompts: totalPrompts,
          }
        },
      });
    }

    // Get total requests and tokens from request logs
    const usageStats = await db
      .select({
        totalRequests: count(requestLogs.id),
        totalTokens: sum(requestLogs.tokensUsed),
      })
      .from(requestLogs)
      .where(
        and(
          eq(requestLogs.workspaceId, workspace.id),
          gte(requestLogs.createdAt, startTime)
        )
      );

    const totalRequests = Number(usageStats[0]?.totalRequests) || 0;
    const totalTokens = Number(usageStats[0]?.totalTokens) || 0;

    // Get requests by virtual key
    const requestsByVirtualKeyResult = await db
      .select({
        virtualKeyId: requestLogs.virtualKeyId,
        requests: count(requestLogs.id),
        tokens: sum(requestLogs.tokensUsed),
      })
      .from(requestLogs)
      .where(
        and(
          eq(requestLogs.workspaceId, workspace.id),
          gte(requestLogs.createdAt, startTime)
        )
      )
      .groupBy(requestLogs.virtualKeyId);

    // Map virtual key IDs to names
    const virtualKeyMap = new Map(
      workspaceVirtualKeys.map(k => [k.id, k.id.substring(0, 8)])
    );

    const requestsByVirtualKey: Record<string, { requests: number; tokens: number }> = {};
    for (const row of requestsByVirtualKeyResult) {
      const keyName = virtualKeyMap.get(row.virtualKeyId) || row.virtualKeyId;
      requestsByVirtualKey[keyName] = {
        requests: Number(row.requests) || 0,
        tokens: Number(row.tokens) || 0,
      };
    }

    // Get requests over time (grouped by hour)
    const requestsByTimeWindow = await db
      .select({
        windowStart: sql<Date>`datetime(${requestLogs.createdAt} / 1000, 'unixepoch', 'start of hour')`.as('windowStart'),
        requests: count(requestLogs.id),
        tokens: sum(requestLogs.tokensUsed),
      })
      .from(requestLogs)
      .where(
        and(
          eq(requestLogs.workspaceId, workspace.id),
          gte(requestLogs.createdAt, startTime)
        )
      )
      .groupBy(sql`windowStart`)
      .orderBy(sql`windowStart`);

    // Get top models
    const topModelsResult = await db
      .select({
        model: requestLogs.model,
        requests: count(requestLogs.id),
      })
      .from(requestLogs)
      .where(
        and(
          eq(requestLogs.workspaceId, workspace.id),
          gte(requestLogs.createdAt, startTime),
          sql`${requestLogs.model} IS NOT NULL`
        )
      )
      .groupBy(requestLogs.model)
      .orderBy(sql`${count(requestLogs.id)} DESC`)
      .limit(10);

    const topModels = topModelsResult.map(row => ({
      model: row.model || 'unknown',
      requests: Number(row.requests) || 0,
    }));

    // Calculate success rate from status codes
    const statusStats = await db
      .select({
        statusCode: requestLogs.statusCode,
        count: count(requestLogs.id),
      })
      .from(requestLogs)
      .where(
        and(
          eq(requestLogs.workspaceId, workspace.id),
          gte(requestLogs.createdAt, startTime)
        )
      )
      .groupBy(requestLogs.statusCode);

    const requestsByStatus: Record<string, number> = {
      '200': 0,
      '400': 0,
      '500': 0,
    };

    let successfulRequests = 0;
    for (const row of statusStats) {
      const status = row.statusCode;
      const count = Number(row.count) || 0;
      
      if (status >= 200 && status < 300) {
        requestsByStatus['200'] += count;
        successfulRequests += count;
      } else if (status >= 400 && status < 500) {
        requestsByStatus['400'] += count;
      } else if (status >= 500) {
        requestsByStatus['500'] += count;
      }
    }

    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 0;

    // Calculate average response time
    const avgResponseTimeResult = await db
      .select({
        avgTime: avg(requestLogs.responseTime),
      })
      .from(requestLogs)
      .where(
        and(
          eq(requestLogs.workspaceId, workspace.id),
          gte(requestLogs.createdAt, startTime),
          sql`${requestLogs.responseTime} IS NOT NULL`
        )
      );

    const avgResponseTime = Number(avgResponseTimeResult[0]?.avgTime) || 0;

    return c.json({
      status: 'success',
      data: {
        totalRequests,
        totalTokens,
        successRate: Number(successRate.toFixed(2)),
        avgResponseTime: Math.round(avgResponseTime),
        requestsByVirtualKey,
        requestsByTimeWindow: requestsByTimeWindow.map(row => ({
          timestamp: row.windowStart,
          requests: Number(row.requests) || 0,
          tokens: Number(row.tokens) || 0,
        })),
        topModels,
        requestsByStatus,
        resourceCounts: {
          virtualKeys: totalVirtualKeys,
          providerKeys: totalProviderKeys,
          prompts: totalPrompts,
        },
      },
    });
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to fetch analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      500
    );
  }
}

/**
 * Parse time range string to milliseconds
 */
function parseTimeRange(timeRange: string): number {
  const match = timeRange.match(/^(\d+)([hdw])$/);
  if (!match) {
    return 24 * 60 * 60 * 1000; // default to 24 hours
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'w':
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}


import { Context, Next } from 'hono';
import { getDb } from '../db';
import { apiKeys, workspaces, providerKeys } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import { compareSync } from 'bcryptjs';
import { HEADER_KEYS } from '../globals';

/**
 * API Key Authentication Middleware
 * Validates API keys and loads workspace context
 */
export async function apiKeyAuth(c: Context, next: Next) {
  const timestamp = new Date().toISOString();
  
  try {
    // Extract API key from headers
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    const apiKeyHeader = c.req.header(HEADER_KEYS.API_KEY);
    
    let apiKey: string | undefined;
    
    // Try x-axon-api-key header first, then Authorization header
    if (apiKeyHeader) {
      apiKey = apiKeyHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      apiKey = authHeader.substring(7);
    }
    
    // If no API key provided, continue without authentication
    // (This allows pass-through for requests that don't need auth)
    if (!apiKey) {
      return next();
    }
    
    // Get database connection
    const db = getDb();
    
    // Look up API key by hash
    // We need to check all keys since we hash them
    const allKeys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.isActive, true));
    
    let matchedKey: typeof apiKeys.$inferSelect | null = null;
    
    // Find matching key by comparing hashes
    for (const key of allKeys) {
      if (compareSync(apiKey, key.keyHash)) {
        matchedKey = key;
        break;
      }
    }
    
    if (!matchedKey) {
      console.warn(`[${timestamp}] [ApiKeyAuth] [WARN] Invalid API key provided`);
      return c.json(
        {
          status: 'failure',
          message: 'Invalid API key',
        },
        401
      );
    }
    
    // Check if key has expired
    if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
      console.warn(`[${timestamp}] [ApiKeyAuth] [WARN] Expired API key used: ${matchedKey.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key has expired',
        },
        401
      );
    }
    
    // Load workspace
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, matchedKey.workspaceId))
      .get();
    
    if (!workspace) {
      console.error(`[${timestamp}] [ApiKeyAuth] [ERROR] Workspace not found for API key: ${matchedKey.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Workspace not found',
        },
        500
      );
    }
    
    // Load provider keys for this workspace
    const workspaceProviderKeys = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.workspaceId, workspace.id));
    
    // Attach to context
    c.set('apiKey', matchedKey);
    c.set('workspace', workspace);
    c.set('providerKeys', workspaceProviderKeys);
    
    console.log(
      `[${timestamp}] [ApiKeyAuth] [INFO] Authenticated: workspace=${workspace.id} apiKey=${matchedKey.name}`
    );
    
    return next();
  } catch (error: any) {
    console.error(`[${timestamp}] [ApiKeyAuth] [ERROR] Authentication error:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Authentication error',
      },
      500
    );
  }
}

/**
 * Middleware to require authentication
 * Use this on routes that must have a valid API key
 */
export async function requireAuth(c: Context, next: Next) {
  const apiKey = c.get('apiKey');
  
  if (!apiKey) {
    const timestamp = new Date().toISOString();
    console.warn(`[${timestamp}] [ApiKeyAuth] [WARN] Authentication required but not provided`);
    return c.json(
      {
        status: 'failure',
        message: 'Authentication required',
      },
      401
    );
  }
  
  return next();
}

/**
 * Middleware to check specific permissions
 */
export function requirePermission(permission: string) {
  return async (c: Context, next: Next) => {
    const apiKey = c.get('apiKey');
    const timestamp = new Date().toISOString();
    
    if (!apiKey) {
      console.warn(`[${timestamp}] [ApiKeyAuth] [WARN] Permission check failed: not authenticated`);
      return c.json(
        {
          status: 'failure',
          message: 'Authentication required',
        },
        401
      );
    }
    
    const permissions = apiKey.permissions as Record<string, boolean>;
    
    if (!permissions[permission]) {
      console.warn(
        `[${timestamp}] [ApiKeyAuth] [WARN] Permission denied: ${permission} for key ${apiKey.name}`
      );
      return c.json(
        {
          status: 'failure',
          message: `Permission denied: ${permission}`,
        },
        403
      );
    }
    
    return next();
  };
}


import { Context, Next } from 'hono';
import { getDb } from '../db';
import { virtualKeys, workspaces, providerKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { compareSync } from 'bcryptjs';
import { HEADER_KEYS } from '../globals';

/**
 * Virtual Key Authentication Middleware
 * Validates virtual keys and loads workspace context for gateway access
 */
export async function virtualKeyAuth(c: Context, next: Next) {
  const timestamp = new Date().toISOString();
  
  try {
    // Extract virtual key from headers
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    const virtualKeyHeader = c.req.header(HEADER_KEYS.API_KEY);
    
    let virtualKey: string | undefined;
    
    // Try x-axon-api-key header first, then Authorization header
    if (virtualKeyHeader) {
      virtualKey = virtualKeyHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      virtualKey = authHeader.substring(7);
    }
    
    // If no virtual key provided, continue without authentication
    // (This allows pass-through for requests that don't need auth)
    if (!virtualKey) {
      return next();
    }
    
    // Get database connection
    const db = getDb();
    
    // Look up virtual key by hash
    // We need to check all keys since we hash them
    const allKeys = await db
      .select()
      .from(virtualKeys)
      .where(eq(virtualKeys.isActive, true));
    
    let matchedKey: typeof virtualKeys.$inferSelect | null = null;
    
    // Find matching key by comparing hashes
    for (const key of allKeys) {
      if (compareSync(virtualKey, key.keyHash)) {
        matchedKey = key;
        break;
      }
    }
    
    if (!matchedKey) {
      console.warn(`[${timestamp}] [VirtualKeyAuth] [WARN] Invalid virtual key provided`);
      return c.json(
        {
          status: 'failure',
          message: 'Invalid virtual key',
        },
        401
      );
    }
    
    // Check if key has expired
    if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
      console.warn(`[${timestamp}] [VirtualKeyAuth] [WARN] Expired virtual key used: ${matchedKey.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key has expired',
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
      console.error(`[${timestamp}] [VirtualKeyAuth] [ERROR] Workspace not found for virtual key: ${matchedKey.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Workspace not found',
        },
        500
      );
    }
    
    // Load the specific provider key linked to this virtual key
    const providerKey = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, matchedKey.providerKeyId))
      .get();
    
    if (!providerKey) {
      console.error(`[${timestamp}] [VirtualKeyAuth] [ERROR] Provider key not found for virtual key: ${matchedKey.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key configuration error - provider key not found',
        },
        500
      );
    }
    
    // Attach to context
    c.set('virtualKey', matchedKey);
    c.set('workspace', workspace);
    c.set('providerKey', providerKey);
    
    console.log(
      `[${timestamp}] [VirtualKeyAuth] [INFO] Authenticated: workspace=${workspace.id} virtualKey=${matchedKey.name} provider=${providerKey.provider}`
    );
    
    return next();
  } catch (error: any) {
    console.error(`[${timestamp}] [VirtualKeyAuth] [ERROR] Authentication error:`, error.message);
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
 * Middleware to require virtual key authentication
 * Use this on routes that must have a valid virtual key
 */
export async function requireVirtualKey(c: Context, next: Next) {
  const virtualKey = c.get('virtualKey');
  
  if (!virtualKey) {
    return c.json(
      {
        status: 'failure',
        message: 'Virtual key required',
      },
      401
    );
  }
  
  return next();
}

/**
 * Middleware to validate that the requested model is allowed by the virtual key
 * Extracts model from request body and checks against allowedModels list
 */
export async function validateRequestedModel(c: Context, next: Next) {
  const timestamp = new Date().toISOString();
  const virtualKey = c.get('virtualKey');
  
  if (!virtualKey) {
    return next(); // If no virtual key, skip validation
  }
  
  // If no model restrictions, allow all models from this provider
  if (!virtualKey.allowedModels || virtualKey.allowedModels.length === 0) {
    return next();
  }
  
  try {
    // Extract model from request body
    // Clone the request so we can read it again in the handler
    const requestClone = c.req.raw.clone();
    const body = await requestClone.json() as { model?: string };
    const requestedModel = body?.model;
    
    if (!requestedModel) {
      // No model specified in request, let the handler deal with it
      return next();
    }
    
    // Check if the requested model is in the allowed list
    if (!virtualKey.allowedModels.includes(requestedModel)) {
      console.warn(
        `[${timestamp}] [VirtualKeyAuth] [WARN] Model "${requestedModel}" not allowed for virtual key ${virtualKey.name}. Allowed: ${virtualKey.allowedModels.join(', ')}`
      );
      return c.json(
        {
          status: 'failure',
          message: `Model "${requestedModel}" is not allowed for this virtual key. Allowed models: ${virtualKey.allowedModels.join(', ')}`,
        },
        403
      );
    }
    
    console.log(
      `[${timestamp}] [VirtualKeyAuth] [INFO] Model "${requestedModel}" validated for virtual key ${virtualKey.name}`
    );
    
    return next();
  } catch (error: any) {
    // If we can't parse the body, let it pass through and let the handler deal with it
    console.warn(`[${timestamp}] [VirtualKeyAuth] [WARN] Could not parse request body for model validation:`, error.message);
    return next();
  }
}


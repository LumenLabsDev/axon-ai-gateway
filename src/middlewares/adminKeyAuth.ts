import { Context, Next } from 'hono';
import { getDb } from '../db';
import { adminKeys } from '../db/schema';
import { eq } from 'drizzle-orm';
import { compareSync } from 'bcryptjs';

/**
 * Admin Key Authentication Middleware
 * Validates admin keys for accessing the admin panel
 */
export async function adminKeyAuth(c: Context, next: Next) {
  const timestamp = new Date().toISOString();
  
  try {
    // Extract admin key from headers
    const authHeader = c.req.header('Authorization') || c.req.header('authorization');
    const adminKeyHeader = c.req.header('x-axon-admin-key');
    
    let adminKey: string | undefined;
    
    // Try x-axon-admin-key header first, then Authorization header
    if (adminKeyHeader) {
      adminKey = adminKeyHeader;
    } else if (authHeader?.startsWith('Bearer ')) {
      adminKey = authHeader.substring(7);
    }
    
    // Admin routes require authentication
    if (!adminKey) {
      console.warn(`[${timestamp}] [AdminKeyAuth] [WARN] No admin key provided`);
      return c.json(
        {
          status: 'failure',
          message: 'Admin authentication required',
        },
        401
      );
    }
    
    // Get database connection
    const db = getDb();
    
    // Look up admin key by hash
    // We need to check all keys since we hash them
    const allKeys = await db
      .select()
      .from(adminKeys)
      .where(eq(adminKeys.isActive, true));
    
    let matchedKey: typeof adminKeys.$inferSelect | null = null;
    
    // Find matching key by comparing hashes
    for (const key of allKeys) {
      if (compareSync(adminKey, key.keyHash)) {
        matchedKey = key;
        break;
      }
    }
    
    if (!matchedKey) {
      console.warn(`[${timestamp}] [AdminKeyAuth] [WARN] Invalid admin key provided`);
      return c.json(
        {
          status: 'failure',
          message: 'Invalid admin key',
        },
        401
      );
    }
    
    // Check if key has expired
    if (matchedKey.expiresAt && new Date(matchedKey.expiresAt) < new Date()) {
      console.warn(`[${timestamp}] [AdminKeyAuth] [WARN] Expired admin key used: ${matchedKey.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Admin key has expired',
        },
        401
      );
    }
    
    // Attach to context
    c.set('adminKey', matchedKey);
    
    console.log(
      `[${timestamp}] [AdminKeyAuth] [INFO] Admin authenticated: ${matchedKey.name}`
    );
    
    return next();
  } catch (error: any) {
    console.error(`[${timestamp}] [AdminKeyAuth] [ERROR] Authentication error:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Authentication error',
      },
      500
    );
  }
}


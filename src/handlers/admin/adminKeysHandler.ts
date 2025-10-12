import { Context } from 'hono';
import { getDb } from '../../db';
import { adminKeys, NewAdminKey } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { maskApiKey } from '../../services/encryptionService';

/**
 * Generate a secure admin key
 */
function generateAdminKey(): string {
  const prefix = 'ak';
  const random = randomBytes(32).toString('base64url');
  return `${prefix}_${random}`;
}

/**
 * List admin keys (masked)
 * GET /v1/admin/admin-keys
 */
export async function listAdminKeys(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const keys = await db
      .select()
      .from(adminKeys);
    
    // Mask the keys
    const maskedKeys = keys.map((key) => ({
      id: key.id,
      name: key.name,
      description: key.description,
      keyHash: maskApiKey(key.keyHash),
      createdAt: key.createdAt,
      expiresAt: key.expiresAt,
      isActive: key.isActive,
    }));
    
    console.log(`[${timestamp}] [AdminKeysHandler] [INFO] Listed ${maskedKeys.length} admin keys`);
    
    return c.json({
      status: 'success',
      data: maskedKeys,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [AdminKeysHandler] [ERROR] Failed to list admin keys:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list admin keys',
      },
      500
    );
  }
}

/**
 * Get admin key details (masked)
 * GET /v1/admin/admin-keys/:id
 */
export async function getAdminKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  
  try {
    const key = await db
      .select()
      .from(adminKeys)
      .where(eq(adminKeys.id, id))
      .get();
    
    if (!key) {
      console.warn(`[${timestamp}] [AdminKeysHandler] [WARN] Admin key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Admin key not found',
        },
        404
      );
    }
    
    // Mask the key
    const maskedKey = {
      ...key,
      keyHash: maskApiKey(key.keyHash),
    };
    
    console.log(`[${timestamp}] [AdminKeysHandler] [INFO] Retrieved admin key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [AdminKeysHandler] [ERROR] Failed to get admin key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get admin key',
      },
      500
    );
  }
}

/**
 * Create a new admin key
 * POST /v1/admin/admin-keys
 * Returns the plain key ONCE
 */
export async function createAdminKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const body = await c.req.json();
    const {
      name,
      description,
      expiresAt,
    } = body;
    
    if (!name) {
      return c.json(
        {
          status: 'failure',
          message: 'Name is required',
        },
        400
      );
    }
    
    // Generate admin key
    const plainKey = generateAdminKey();
    const keyHash = hashSync(plainKey, 10);
    
    const newAdminKey: NewAdminKey = {
      keyHash,
      name,
      description,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };
    
    const result = await db.insert(adminKeys).values(newAdminKey).returning();
    const created = result[0];
    
    console.log(`[${timestamp}] [AdminKeysHandler] [INFO] Created admin key: ${created.id} (${created.name})`);
    
    // Return the plain key ONCE (this is the only time it will be visible)
    return c.json(
      {
        status: 'success',
        data: {
          ...created,
          keyHash: maskApiKey(created.keyHash),
          plainKey, // Only returned once
        },
        message: 'Admin key created. Save the plainKey now - it will not be shown again.',
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [AdminKeysHandler] [ERROR] Failed to create admin key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create admin key',
      },
      500
    );
  }
}

/**
 * Update admin key
 * PATCH /v1/admin/admin-keys/:id
 */
export async function updateAdminKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const {
      name,
      description,
      isActive,
      expiresAt,
    } = body;
    
    // Check if key exists
    const existing = await db
      .select()
      .from(adminKeys)
      .where(eq(adminKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [AdminKeysHandler] [WARN] Admin key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Admin key not found',
        },
        404
      );
    }
    
    // Update key
    const updateData: Partial<typeof adminKeys.$inferInsert> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expiresAt !== undefined) updateData.expiresAt = new Date(expiresAt);
    
    const result = await db
      .update(adminKeys)
      .set(updateData)
      .where(eq(adminKeys.id, id))
      .returning();
    
    const updated = result[0];
    
    // Mask the key
    const maskedKey = {
      ...updated,
      keyHash: maskApiKey(updated.keyHash),
    };
    
    console.log(`[${timestamp}] [AdminKeysHandler] [INFO] Updated admin key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [AdminKeysHandler] [ERROR] Failed to update admin key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update admin key',
      },
      500
    );
  }
}

/**
 * Delete/revoke admin key
 * DELETE /v1/admin/admin-keys/:id
 */
export async function deleteAdminKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  
  try {
    // Check if key exists
    const existing = await db
      .select()
      .from(adminKeys)
      .where(eq(adminKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [AdminKeysHandler] [WARN] Admin key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Admin key not found',
        },
        404
      );
    }
    
    await db.delete(adminKeys).where(eq(adminKeys.id, id));
    
    console.log(`[${timestamp}] [AdminKeysHandler] [INFO] Deleted admin key: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'Admin key deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [AdminKeysHandler] [ERROR] Failed to delete admin key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete admin key',
      },
      500
    );
  }
}


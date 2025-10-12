import { Context } from 'hono';
import { getDb } from '../../db';
import { apiKeys, NewApiKey } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { maskApiKey } from '../../services/encryptionService';
import { getCurrentUsage } from '../../services/rateLimitService';

/**
 * Generate a secure API key
 */
function generateApiKey(): string {
  const prefix = 'pk';
  const random = randomBytes(32).toString('base64url');
  return `${prefix}_${random}`;
}

/**
 * List API keys (masked)
 * GET /v1/admin/api-keys
 */
export async function listApiKeys(c: Context) {
  const timestamp = new Date().toISOString();
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
  
  try {
    const keys = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.workspaceId, workspace.id));
    
    // Mask the keys and add usage info
    const maskedKeys = await Promise.all(
      keys.map(async (key) => {
        const usage = await getCurrentUsage(key.id);
        return {
          id: key.id,
          name: key.name,
          description: key.description,
          keyHash: maskApiKey(key.keyHash),
          permissions: key.permissions,
          rateLimitRpm: key.rateLimitRpm,
          rateLimitTpm: key.rateLimitTpm,
          allowedModels: key.allowedModels,
          metadata: key.metadata,
          createdBy: key.createdBy,
          createdAt: key.createdAt,
          expiresAt: key.expiresAt,
          isActive: key.isActive,
          currentUsage: usage,
        };
      })
    );
    
    console.log(`[${timestamp}] [ApiKeysHandler] [INFO] Listed ${maskedKeys.length} API keys for workspace ${workspace.id}`);
    
    return c.json({
      status: 'success',
      data: maskedKeys,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ApiKeysHandler] [ERROR] Failed to list API keys:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list API keys',
      },
      500
    );
  }
}

/**
 * Get API key details (masked)
 * GET /v1/admin/api-keys/:id
 */
export async function getApiKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const key = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .get();
    
    if (!key) {
      console.warn(`[${timestamp}] [ApiKeysHandler] [WARN] API key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && key.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [ApiKeysHandler] [WARN] API key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key not found',
        },
        404
      );
    }
    
    // Get usage stats
    const usage = await getCurrentUsage(id);
    
    // Mask the key
    const maskedKey = {
      ...key,
      keyHash: maskApiKey(key.keyHash),
      currentUsage: usage,
    };
    
    console.log(`[${timestamp}] [ApiKeysHandler] [INFO] Retrieved API key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ApiKeysHandler] [ERROR] Failed to get API key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get API key',
      },
      500
    );
  }
}

/**
 * Create a new API key
 * POST /v1/admin/api-keys
 * Returns the plain key ONCE
 */
export async function createApiKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const workspace = c.get('workspace');
  const currentApiKey = c.get('apiKey');
  
  if (!workspace) {
    return c.json(
      {
        status: 'failure',
        message: 'Workspace context required',
      },
      400
    );
  }
  
  try {
    const body = await c.req.json();
    const {
      name,
      description,
      permissions,
      rateLimitRpm,
      rateLimitTpm,
      allowedModels,
      metadata,
      expiresAt,
    } = body;
    
    if (!name || !permissions) {
      return c.json(
        {
          status: 'failure',
          message: 'Name and permissions are required',
        },
        400
      );
    }
    
    // Generate API key
    const plainKey = generateApiKey();
    const keyHash = hashSync(plainKey, 10);
    
    const newApiKey: NewApiKey = {
      workspaceId: workspace.id,
      keyHash,
      name,
      description,
      permissions,
      rateLimitRpm,
      rateLimitTpm,
      allowedModels,
      metadata,
      createdBy: currentApiKey?.createdBy,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };
    
    const result = await db.insert(apiKeys).values(newApiKey).returning();
    const created = result[0];
    
    console.log(`[${timestamp}] [ApiKeysHandler] [INFO] Created API key: ${created.id} (${created.name}) in workspace ${workspace.id}`);
    
    // Return the plain key ONCE (this is the only time it will be visible)
    return c.json(
      {
        status: 'success',
        data: {
          ...created,
          keyHash: maskApiKey(created.keyHash),
          plainKey, // Only returned once
        },
        message: 'API key created. Save the plainKey now - it will not be shown again.',
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [ApiKeysHandler] [ERROR] Failed to create API key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create API key',
      },
      500
    );
  }
}

/**
 * Update API key
 * PATCH /v1/admin/api-keys/:id
 */
export async function updateApiKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const body = await c.req.json();
    const {
      name,
      description,
      permissions,
      rateLimitRpm,
      rateLimitTpm,
      allowedModels,
      metadata,
      isActive,
      expiresAt,
    } = body;
    
    // Check if key exists
    const existing = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [ApiKeysHandler] [WARN] API key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [ApiKeysHandler] [WARN] API key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key not found',
        },
        404
      );
    }
    
    // Update key
    const updateData: Partial<typeof apiKeys.$inferInsert> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (permissions !== undefined) updateData.permissions = permissions;
    if (rateLimitRpm !== undefined) updateData.rateLimitRpm = rateLimitRpm;
    if (rateLimitTpm !== undefined) updateData.rateLimitTpm = rateLimitTpm;
    if (allowedModels !== undefined) updateData.allowedModels = allowedModels;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expiresAt !== undefined) updateData.expiresAt = new Date(expiresAt);
    
    const result = await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id))
      .returning();
    
    const updated = result[0];
    
    // Mask the key
    const maskedKey = {
      ...updated,
      keyHash: maskApiKey(updated.keyHash),
    };
    
    console.log(`[${timestamp}] [ApiKeysHandler] [INFO] Updated API key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ApiKeysHandler] [ERROR] Failed to update API key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update API key',
      },
      500
    );
  }
}

/**
 * Delete/revoke API key
 * DELETE /v1/admin/api-keys/:id
 */
export async function deleteApiKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    // Check if key exists
    const existing = await db
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [ApiKeysHandler] [WARN] API key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [ApiKeysHandler] [WARN] API key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'API key not found',
        },
        404
      );
    }
    
    await db.delete(apiKeys).where(eq(apiKeys.id, id));
    
    console.log(`[${timestamp}] [ApiKeysHandler] [INFO] Deleted API key: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'API key deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ApiKeysHandler] [ERROR] Failed to delete API key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete API key',
      },
      500
    );
  }
}


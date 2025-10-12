import { Context } from 'hono';
import { getDb } from '../../db';
import { virtualKeys, NewVirtualKey, providerKeys } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { maskApiKey } from '../../services/encryptionService';
import { getCurrentUsage } from '../../services/rateLimitService';

/**
 * Generate a secure virtual key
 */
function generateVirtualKey(): string {
  const prefix = 'vk';
  const random = randomBytes(32).toString('base64url');
  return `${prefix}_${random}`;
}

/**
 * List virtual keys (masked)
 * GET /v1/admin/virtual-keys
 */
export async function listVirtualKeys(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const workspace = c.get('workspace');
  
  try {
    let query = db.select({
      virtualKey: virtualKeys,
      providerKey: providerKeys,
    }).from(virtualKeys)
      .leftJoin(providerKeys, eq(virtualKeys.providerKeyId, providerKeys.id));
    
    // If workspace context exists, filter by workspace
    if (workspace) {
      query = query.where(eq(virtualKeys.workspaceId, workspace.id)) as any;
    }
    
    const results = await query;
    
    // Mask the keys and add usage info
    const maskedKeys = await Promise.all(
      results.map(async ({ virtualKey: key, providerKey }) => {
        const usage = await getCurrentUsage(key.id);
        return {
          id: key.id,
          workspaceId: key.workspaceId,
          providerKeyId: key.providerKeyId,
          providerKeyName: providerKey?.name,
          provider: providerKey?.provider,
          name: key.name,
          description: key.description,
          keyHash: maskApiKey(key.keyHash),
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
    
    console.log(`[${timestamp}] [VirtualKeysHandler] [INFO] Listed ${maskedKeys.length} virtual keys${workspace ? ` for workspace ${workspace.id}` : ''}`);
    
    return c.json({
      status: 'success',
      data: maskedKeys,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [VirtualKeysHandler] [ERROR] Failed to list virtual keys:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list virtual keys',
      },
      500
    );
  }
}

/**
 * Get virtual key details (masked)
 * GET /v1/admin/virtual-keys/:id
 */
export async function getVirtualKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const result = await db
      .select({
        virtualKey: virtualKeys,
        providerKey: providerKeys,
      })
      .from(virtualKeys)
      .leftJoin(providerKeys, eq(virtualKeys.providerKeyId, providerKeys.id))
      .where(eq(virtualKeys.id, id))
      .get();
    
    if (!result) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Virtual key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key not found',
        },
        404
      );
    }
    
    const { virtualKey: key, providerKey } = result;
    
    // Check workspace access if context exists
    if (workspace && key.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Virtual key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key not found',
        },
        404
      );
    }
    
    // Get usage stats
    const usage = await getCurrentUsage(id);
    
    // Mask the key and include provider info
    const maskedKey = {
      ...key,
      keyHash: maskApiKey(key.keyHash),
      providerKeyName: providerKey?.name,
      provider: providerKey?.provider,
      currentUsage: usage,
    };
    
    console.log(`[${timestamp}] [VirtualKeysHandler] [INFO] Retrieved virtual key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [VirtualKeysHandler] [ERROR] Failed to get virtual key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get virtual key',
      },
      500
    );
  }
}

/**
 * Create a new virtual key
 * POST /v1/admin/virtual-keys
 * Returns the plain key ONCE
 */
export async function createVirtualKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const body = await c.req.json();
    const {
      workspaceId,
      providerKeyId,
      name,
      description,
      rateLimitRpm,
      rateLimitTpm,
      allowedModels,
      metadata,
      expiresAt,
    } = body;
    
    if (!workspaceId || !name || !providerKeyId) {
      return c.json(
        {
          status: 'failure',
          message: 'Workspace ID, provider key ID, and name are required',
        },
        400
      );
    }
    
    // Validate that the provider key exists and belongs to the workspace
    const providerKey = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, providerKeyId))
      .get();
    
    if (!providerKey) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Provider key not found: ${providerKeyId}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    if (providerKey.workspaceId !== workspaceId) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Provider key ${providerKeyId} does not belong to workspace ${workspaceId}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key does not belong to the specified workspace',
        },
        400
      );
    }
    
    // Validate allowed models if provided
    if (allowedModels && Array.isArray(allowedModels) && allowedModels.length > 0) {
      // In the future, we could add provider-specific model validation here
      // For now, just log that models are being restricted
      console.log(`[${timestamp}] [VirtualKeysHandler] [INFO] Virtual key will be restricted to models: ${allowedModels.join(', ')}`);
    }
    
    // Generate virtual key
    const plainKey = generateVirtualKey();
    const keyHash = hashSync(plainKey, 10);
    
    const newVirtualKey: NewVirtualKey = {
      workspaceId,
      providerKeyId,
      keyHash,
      name,
      description,
      rateLimitRpm,
      rateLimitTpm,
      allowedModels,
      metadata,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    };
    
    const result = await db.insert(virtualKeys).values(newVirtualKey).returning();
    const created = result[0];
    
    console.log(`[${timestamp}] [VirtualKeysHandler] [INFO] Created virtual key: ${created.id} (${created.name}) linked to provider ${providerKey.provider} in workspace ${workspaceId}`);
    
    // Return the plain key ONCE (this is the only time it will be visible)
    return c.json(
      {
        status: 'success',
        data: {
          ...created,
          keyHash: maskApiKey(created.keyHash),
          providerKeyName: providerKey.name,
          provider: providerKey.provider,
          plainKey, // Only returned once
        },
        message: 'Virtual key created. Save the plainKey now - it will not be shown again.',
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [VirtualKeysHandler] [ERROR] Failed to create virtual key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create virtual key',
      },
      500
    );
  }
}

/**
 * Update virtual key
 * PATCH /v1/admin/virtual-keys/:id
 */
export async function updateVirtualKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const body = await c.req.json();
    const {
      name,
      description,
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
      .from(virtualKeys)
      .where(eq(virtualKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Virtual key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key not found',
        },
        404
      );
    }
    
    // Check workspace access if context exists
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Virtual key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key not found',
        },
        404
      );
    }
    
    // Update key
    const updateData: Partial<typeof virtualKeys.$inferInsert> = {};
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (rateLimitRpm !== undefined) updateData.rateLimitRpm = rateLimitRpm;
    if (rateLimitTpm !== undefined) updateData.rateLimitTpm = rateLimitTpm;
    if (allowedModels !== undefined) updateData.allowedModels = allowedModels;
    if (metadata !== undefined) updateData.metadata = metadata;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (expiresAt !== undefined) updateData.expiresAt = new Date(expiresAt);
    
    const result = await db
      .update(virtualKeys)
      .set(updateData)
      .where(eq(virtualKeys.id, id))
      .returning();
    
    const updated = result[0];
    
    // Mask the key
    const maskedKey = {
      ...updated,
      keyHash: maskApiKey(updated.keyHash),
    };
    
    console.log(`[${timestamp}] [VirtualKeysHandler] [INFO] Updated virtual key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [VirtualKeysHandler] [ERROR] Failed to update virtual key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update virtual key',
      },
      500
    );
  }
}

/**
 * Delete/revoke virtual key
 * DELETE /v1/admin/virtual-keys/:id
 */
export async function deleteVirtualKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    // Check if key exists
    const existing = await db
      .select()
      .from(virtualKeys)
      .where(eq(virtualKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Virtual key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key not found',
        },
        404
      );
    }
    
    // Check workspace access if context exists
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [VirtualKeysHandler] [WARN] Virtual key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Virtual key not found',
        },
        404
      );
    }
    
    await db.delete(virtualKeys).where(eq(virtualKeys.id, id));
    
    console.log(`[${timestamp}] [VirtualKeysHandler] [INFO] Deleted virtual key: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'Virtual key deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [VirtualKeysHandler] [ERROR] Failed to delete virtual key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete virtual key',
      },
      500
    );
  }
}


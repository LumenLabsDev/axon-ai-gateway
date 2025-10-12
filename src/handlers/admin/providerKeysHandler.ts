import { Context } from 'hono';
import { getDb } from '../../db';
import { providerKeys, NewProviderKey } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { encryptProviderKey, maskApiKey } from '../../services/encryptionService';

/**
 * List provider keys (masked)
 * GET /v1/admin/provider-keys
 */
export async function listProviderKeys(c: Context) {
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
      .from(providerKeys)
      .where(eq(providerKeys.workspaceId, workspace.id));
    
    // Mask the keys before returning
    const maskedKeys = keys.map((key) => ({
      ...key,
      encryptedKey: maskApiKey(key.encryptedKey),
    }));
    
    console.log(`[${timestamp}] [ProviderKeysHandler] [INFO] Listed ${maskedKeys.length} provider keys for workspace ${workspace.id}`);
    
    return c.json({
      status: 'success',
      data: maskedKeys,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ProviderKeysHandler] [ERROR] Failed to list provider keys:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list provider keys',
      },
      500
    );
  }
}

/**
 * Get provider key details (masked)
 * GET /v1/admin/provider-keys/:id
 */
export async function getProviderKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const key = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, id))
      .get();
    
    if (!key) {
      console.warn(`[${timestamp}] [ProviderKeysHandler] [WARN] Provider key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && key.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [ProviderKeysHandler] [WARN] Provider key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    // Mask the key
    const maskedKey = {
      ...key,
      encryptedKey: maskApiKey(key.encryptedKey),
    };
    
    console.log(`[${timestamp}] [ProviderKeysHandler] [INFO] Retrieved provider key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ProviderKeysHandler] [ERROR] Failed to get provider key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get provider key',
      },
      500
    );
  }
}

/**
 * Create a new provider key
 * POST /v1/admin/provider-keys
 */
export async function createProviderKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const workspace = c.get('workspace');
  const apiKey = c.get('apiKey');
  
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
    const { name, provider, apiKey: providerApiKey } = body;
    
    if (!name || !provider || !providerApiKey) {
      return c.json(
        {
          status: 'failure',
          message: 'Name, provider, and apiKey are required',
        },
        400
      );
    }
    
    // Encrypt the provider API key
    const encryptedKey = encryptProviderKey(providerApiKey);
    
    const newProviderKey: NewProviderKey = {
      workspaceId: workspace.id,
      name,
      provider,
      encryptedKey,
      createdBy: apiKey?.createdBy,
    };
    
    const result = await db.insert(providerKeys).values(newProviderKey).returning();
    const created = result[0];
    
    // Return masked key
    const maskedKey = {
      ...created,
      encryptedKey: maskApiKey(created.encryptedKey),
    };
    
    console.log(`[${timestamp}] [ProviderKeysHandler] [INFO] Created provider key: ${created.id} (${created.provider}) in workspace ${workspace.id}`);
    
    return c.json(
      {
        status: 'success',
        data: maskedKey,
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [ProviderKeysHandler] [ERROR] Failed to create provider key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create provider key',
      },
      500
    );
  }
}

/**
 * Update provider key
 * PATCH /v1/admin/provider-keys/:id
 */
export async function updateProviderKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const body = await c.req.json();
    const { name, apiKey: providerApiKey } = body;
    
    // Check if key exists
    const existing = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [ProviderKeysHandler] [WARN] Provider key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [ProviderKeysHandler] [WARN] Provider key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    // Update key
    const updateData: Partial<typeof providerKeys.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (providerApiKey !== undefined) {
      updateData.encryptedKey = encryptProviderKey(providerApiKey);
    }
    
    const result = await db
      .update(providerKeys)
      .set(updateData)
      .where(eq(providerKeys.id, id))
      .returning();
    
    const updated = result[0];
    
    // Mask the key
    const maskedKey = {
      ...updated,
      encryptedKey: maskApiKey(updated.encryptedKey),
    };
    
    console.log(`[${timestamp}] [ProviderKeysHandler] [INFO] Updated provider key: ${id}`);
    
    return c.json({
      status: 'success',
      data: maskedKey,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ProviderKeysHandler] [ERROR] Failed to update provider key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update provider key',
      },
      500
    );
  }
}

/**
 * Delete provider key
 * DELETE /v1/admin/provider-keys/:id
 */
export async function deleteProviderKey(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    // Check if key exists
    const existing = await db
      .select()
      .from(providerKeys)
      .where(eq(providerKeys.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [ProviderKeysHandler] [WARN] Provider key not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [ProviderKeysHandler] [WARN] Provider key ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Provider key not found',
        },
        404
      );
    }
    
    await db.delete(providerKeys).where(eq(providerKeys.id, id));
    
    console.log(`[${timestamp}] [ProviderKeysHandler] [INFO] Deleted provider key: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'Provider key deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [ProviderKeysHandler] [ERROR] Failed to delete provider key:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete provider key',
      },
      500
    );
  }
}


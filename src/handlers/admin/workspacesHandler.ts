import { Context } from 'hono';
import { getDb } from '../../db';
import { workspaces, NewWorkspace } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * List all workspaces (Admin only)
 * GET /v1/admin/workspaces
 */
export async function listWorkspaces(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const allWorkspaces = await db.select().from(workspaces);
    
    console.log(`[${timestamp}] [WorkspacesHandler] [INFO] Listed ${allWorkspaces.length} workspaces`);
    
    return c.json({
      status: 'success',
      data: allWorkspaces,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [WorkspacesHandler] [ERROR] Failed to list workspaces:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list workspaces',
      },
      500
    );
  }
}

/**
 * Get workspace details
 * GET /v1/admin/workspaces/:id
 */
export async function getWorkspace(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  
  try {
    const workspace = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .get();
    
    if (!workspace) {
      console.warn(`[${timestamp}] [WorkspacesHandler] [WARN] Workspace not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Workspace not found',
        },
        404
      );
    }
    
    console.log(`[${timestamp}] [WorkspacesHandler] [INFO] Retrieved workspace: ${id}`);
    
    return c.json({
      status: 'success',
      data: workspace,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [WorkspacesHandler] [ERROR] Failed to get workspace:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get workspace',
      },
      500
    );
  }
}

/**
 * Create a new workspace
 * POST /v1/admin/workspaces
 */
export async function createWorkspace(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    const body = await c.req.json();
    const { name, description, metadata } = body;
    
    if (!name) {
      return c.json(
        {
          status: 'failure',
          message: 'Workspace name is required',
        },
        400
      );
    }
    
    const newWorkspace: NewWorkspace = {
      name,
      description,
      metadata: metadata || {},
    };
    
    const result = await db.insert(workspaces).values(newWorkspace).returning();
    const created = result[0];
    
    console.log(`[${timestamp}] [WorkspacesHandler] [INFO] Created workspace: ${created.id} (${created.name})`);
    
    return c.json(
      {
        status: 'success',
        data: created,
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [WorkspacesHandler] [ERROR] Failed to create workspace:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create workspace',
      },
      500
    );
  }
}

/**
 * Update workspace
 * PATCH /v1/admin/workspaces/:id
 */
export async function updateWorkspace(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  
  try {
    const body = await c.req.json();
    const { name, description, metadata } = body;
    
    // Check if workspace exists
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [WorkspacesHandler] [WARN] Workspace not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Workspace not found',
        },
        404
      );
    }
    
    // Update workspace
    const updateData: Partial<typeof workspaces.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (metadata !== undefined) updateData.metadata = metadata;
    
    const result = await db
      .update(workspaces)
      .set(updateData)
      .where(eq(workspaces.id, id))
      .returning();
    
    const updated = result[0];
    
    console.log(`[${timestamp}] [WorkspacesHandler] [INFO] Updated workspace: ${id}`);
    
    return c.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [WorkspacesHandler] [ERROR] Failed to update workspace:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update workspace',
      },
      500
    );
  }
}


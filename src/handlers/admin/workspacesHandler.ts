import { Context } from 'hono';
import { getDb } from '../../db';
import { workspaces, NewWorkspace, adminKeys } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';

/**
 * List all workspaces (Admin only)
 * GET /v1/admin/workspaces
 *
 * Note: Admin keys are workspace-specific, so this only returns the workspace
 * associated with the admin key
 */
export async function listWorkspaces(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const adminKey = c.get('adminKey');

  try {
    // Admin keys are workspace-specific, only return their workspace
    const allWorkspaces = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, adminKey.workspaceId));

    console.log(
      `[${timestamp}] [WorkspacesHandler] [INFO] Admin key listed ${allWorkspaces.length} workspace(s) (workspace: ${adminKey.workspaceId})`
    );

    return c.json({
      status: 'success',
      data: allWorkspaces,
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [WorkspacesHandler] [ERROR] Failed to list workspaces:`,
      error.message
    );
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
      console.warn(
        `[${timestamp}] [WorkspacesHandler] [WARN] Workspace not found: ${id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Workspace not found',
        },
        404
      );
    }

    console.log(
      `[${timestamp}] [WorkspacesHandler] [INFO] Retrieved workspace: ${id}`
    );

    return c.json({
      status: 'success',
      data: workspace,
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [WorkspacesHandler] [ERROR] Failed to get workspace:`,
      error.message
    );
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

    console.log(
      `[${timestamp}] [WorkspacesHandler] [INFO] Created workspace: ${created.id} (${created.name})`
    );

    // Generate workspace-specific admin key
    const plainAdminKey = `ak_${randomBytes(32).toString('base64url')}`;
    const adminKeyHash = hashSync(plainAdminKey, 10);

    const adminKeyResult = await db
      .insert(adminKeys)
      .values({
        workspaceId: created.id,
        keyHash: adminKeyHash,
        name: `${created.name} Admin Key`,
        description: `Admin key for workspace: ${created.name}`,
        isActive: true,
      })
      .returning();

    console.log(
      `[${timestamp}] [WorkspacesHandler] [INFO] Generated admin key for workspace: ${created.id}`
    );

    return c.json(
      {
        status: 'success',
        data: {
          workspace: created,
          adminKey: {
            id: adminKeyResult[0].id,
            plainKey: plainAdminKey, // Only time this is shown
          },
        },
      },
      201
    );
  } catch (error: any) {
    console.error(
      `[${timestamp}] [WorkspacesHandler] [ERROR] Failed to create workspace:`,
      error.message
    );
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
      console.warn(
        `[${timestamp}] [WorkspacesHandler] [WARN] Workspace not found: ${id}`
      );
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

    console.log(
      `[${timestamp}] [WorkspacesHandler] [INFO] Updated workspace: ${id}`
    );

    return c.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [WorkspacesHandler] [ERROR] Failed to update workspace:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update workspace',
      },
      500
    );
  }
}

/**
 * Delete workspace
 * DELETE /v1/admin/workspaces/:id
 */
export async function deleteWorkspace(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');

  try {
    // Check if workspace exists
    const existing = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, id))
      .get();

    if (!existing) {
      console.warn(
        `[${timestamp}] [WorkspacesHandler] [WARN] Workspace not found: ${id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Workspace not found',
        },
        404
      );
    }

    // Delete workspace
    await db.delete(workspaces).where(eq(workspaces.id, id));

    console.log(
      `[${timestamp}] [WorkspacesHandler] [INFO] Deleted workspace: ${id} (${existing.name})`
    );

    return c.json({
      status: 'success',
      message: 'Workspace deleted successfully',
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [WorkspacesHandler] [ERROR] Failed to delete workspace:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete workspace',
      },
      500
    );
  }
}

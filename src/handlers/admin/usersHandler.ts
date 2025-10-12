import { Context } from 'hono';
import { getDb } from '../../db';
import { users, NewUser } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * List users in a workspace
 * GET /v1/admin/users?workspaceId=xxx
 */
export async function listUsers(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const workspace = c.get('workspace');
  const workspaceIdParam = c.req.query('workspaceId');
  
  try {
    let query = db.select().from(users);
    
    // Filter by workspace if provided
    const workspaceId = workspace?.id || workspaceIdParam;
    if (workspaceId) {
      query = query.where(eq(users.workspaceId, workspaceId)) as any;
    }
    
    const workspaceUsers = await query;
    
    console.log(`[${timestamp}] [UsersHandler] [INFO] Listed ${workspaceUsers.length} users${workspaceId ? ` for workspace ${workspaceId}` : ''}`);
    
    return c.json({
      status: 'success',
      data: workspaceUsers,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [UsersHandler] [ERROR] Failed to list users:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list users',
      },
      500
    );
  }
}

/**
 * Get user details
 * GET /v1/admin/users/:id
 */
export async function getUser(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const user = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .get();
    
    if (!user) {
      console.warn(`[${timestamp}] [UsersHandler] [WARN] User not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'User not found',
        },
        404
      );
    }
    
    // Check if user belongs to the current workspace
    if (workspace && user.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [UsersHandler] [WARN] User ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'User not found',
        },
        404
      );
    }
    
    console.log(`[${timestamp}] [UsersHandler] [INFO] Retrieved user: ${id}`);
    
    return c.json({
      status: 'success',
      data: user,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [UsersHandler] [ERROR] Failed to get user:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get user',
      },
      500
    );
  }
}

/**
 * Create/invite a new user
 * POST /v1/admin/users
 */
export async function createUser(c: Context) {
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
    const body = await c.req.json();
    const { email, name, role } = body;
    
    if (!email || !name) {
      return c.json(
        {
          status: 'failure',
          message: 'Email and name are required',
        },
        400
      );
    }
    
    if (role && !['admin', 'editor', 'viewer'].includes(role)) {
      return c.json(
        {
          status: 'failure',
          message: 'Invalid role. Must be admin, editor, or viewer',
        },
        400
      );
    }
    
    const newUser: NewUser = {
      workspaceId: workspace.id,
      email,
      name,
      role: role || 'viewer',
    };
    
    const result = await db.insert(users).values(newUser).returning();
    const created = result[0];
    
    console.log(`[${timestamp}] [UsersHandler] [INFO] Created user: ${created.id} (${created.email}) in workspace ${workspace.id}`);
    
    return c.json(
      {
        status: 'success',
        data: created,
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [UsersHandler] [ERROR] Failed to create user:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create user',
      },
      500
    );
  }
}

/**
 * Update user role
 * PATCH /v1/admin/users/:id
 */
export async function updateUser(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const body = await c.req.json();
    const { name, role } = body;
    
    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [UsersHandler] [WARN] User not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'User not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [UsersHandler] [WARN] User ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'User not found',
        },
        404
      );
    }
    
    if (role && !['admin', 'editor', 'viewer'].includes(role)) {
      return c.json(
        {
          status: 'failure',
          message: 'Invalid role. Must be admin, editor, or viewer',
        },
        400
      );
    }
    
    // Update user
    const updateData: Partial<typeof users.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role as 'admin' | 'editor' | 'viewer';
    
    const result = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, id))
      .returning();
    
    const updated = result[0];
    
    console.log(`[${timestamp}] [UsersHandler] [INFO] Updated user: ${id}`);
    
    return c.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [UsersHandler] [ERROR] Failed to update user:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update user',
      },
      500
    );
  }
}

/**
 * Delete user
 * DELETE /v1/admin/users/:id
 */
export async function deleteUser(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    // Check if user exists
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [UsersHandler] [WARN] User not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'User not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [UsersHandler] [WARN] User ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'User not found',
        },
        404
      );
    }
    
    await db.delete(users).where(eq(users.id, id));
    
    console.log(`[${timestamp}] [UsersHandler] [INFO] Deleted user: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'User deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [UsersHandler] [ERROR] Failed to delete user:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete user',
      },
      500
    );
  }
}


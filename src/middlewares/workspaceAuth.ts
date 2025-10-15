import { Context, Next } from 'hono';

/**
 * Workspace Authorization Middleware
 * Verifies admin key has permission to access workspace-specific data
 * Must run after adminKeyAuth and workspaceContext
 *
 * Note: All admin keys are now workspace-specific (workspaceId is required)
 */
export async function workspaceAuth(c: Context, next: Next) {
  const timestamp = new Date().toISOString();
  const adminKey = c.get('adminKey'); // from adminKeyAuth
  const workspaceId = c.req.header('x-axon-workspace-id');

  // If no workspace requested, continue (for global operations like listing workspaces)
  if (!workspaceId) {
    return next();
  }

  // Verify admin key has access to the requested workspace
  if (adminKey.workspaceId !== workspaceId) {
    console.warn(
      `[${timestamp}] [WorkspaceAuth] [WARN] Insufficient permissions: admin key ${adminKey.id} (workspace ${adminKey.workspaceId}) attempted to access workspace ${workspaceId}`
    );
    return c.json(
      {
        status: 'failure',
        message: 'Insufficient permissions for this workspace',
      },
      403
    );
  }

  console.log(
    `[${timestamp}] [WorkspaceAuth] [INFO] Admin key authorized for workspace: ${workspaceId}`
  );

  return next();
}

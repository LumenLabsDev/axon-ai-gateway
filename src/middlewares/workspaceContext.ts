import { Context, Next } from 'hono';
import { getDb } from '../db';
import { workspaces } from '../db/schema';
import { eq } from 'drizzle-orm';

/**
 * Workspace Context Middleware
 * Extracts workspace ID from header and loads workspace into context
 */
export async function workspaceContext(c: Context, next: Next) {
  const workspaceId = c.req.header('x-axon-workspace-id');

  if (workspaceId) {
    try {
      const db = getDb();
      const [workspace] = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, workspaceId))
        .limit(1);

      if (workspace) {
        c.set('workspace', workspace);
      }
    } catch (error: any) {
      console.error(
        '[WorkspaceContext] [ERROR] Failed to load workspace:',
        error.message
      );
    }
  }

  return next();
}

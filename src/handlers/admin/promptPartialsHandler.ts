import { Context } from 'hono';
import { getDb } from '../../db';
import { promptPartials, NewPromptPartial } from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * List prompt partials
 * GET /v1/admin/prompt-partials
 */
export async function listPromptPartials(c: Context) {
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
    const partials = await db
      .select()
      .from(promptPartials)
      .where(eq(promptPartials.workspaceId, workspace.id));
    
    console.log(`[${timestamp}] [PromptPartialsHandler] [INFO] Listed ${partials.length} prompt partials for workspace ${workspace.id}`);
    
    return c.json({
      status: 'success',
      data: partials,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptPartialsHandler] [ERROR] Failed to list prompt partials:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list prompt partials',
      },
      500
    );
  }
}

/**
 * Get prompt partial details
 * GET /v1/admin/prompt-partials/:id
 */
export async function getPromptPartial(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const partial = await db
      .select()
      .from(promptPartials)
      .where(eq(promptPartials.id, id))
      .get();
    
    if (!partial) {
      console.warn(`[${timestamp}] [PromptPartialsHandler] [WARN] Prompt partial not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt partial not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && partial.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptPartialsHandler] [WARN] Prompt partial ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt partial not found',
        },
        404
      );
    }
    
    console.log(`[${timestamp}] [PromptPartialsHandler] [INFO] Retrieved prompt partial: ${id}`);
    
    return c.json({
      status: 'success',
      data: partial,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptPartialsHandler] [ERROR] Failed to get prompt partial:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get prompt partial',
      },
      500
    );
  }
}

/**
 * Create a new prompt partial
 * POST /v1/admin/prompt-partials
 */
export async function createPromptPartial(c: Context) {
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
    const { name, template } = body;
    
    if (!name || !template) {
      return c.json(
        {
          status: 'failure',
          message: 'Name and template are required',
        },
        400
      );
    }
    
    const newPartial: NewPromptPartial = {
      workspaceId: workspace.id,
      name,
      template,
      version: 1,
      createdBy: apiKey?.createdBy,
    };
    
    const result = await db.insert(promptPartials).values(newPartial).returning();
    const created = result[0];
    
    console.log(`[${timestamp}] [PromptPartialsHandler] [INFO] Created prompt partial: ${created.id} (${created.name}) in workspace ${workspace.id}`);
    
    return c.json(
      {
        status: 'success',
        data: created,
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptPartialsHandler] [ERROR] Failed to create prompt partial:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create prompt partial',
      },
      500
    );
  }
}

/**
 * Update prompt partial
 * PATCH /v1/admin/prompt-partials/:id
 */
export async function updatePromptPartial(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const body = await c.req.json();
    const { name, template } = body;
    
    // Check if partial exists
    const existing = await db
      .select()
      .from(promptPartials)
      .where(eq(promptPartials.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [PromptPartialsHandler] [WARN] Prompt partial not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt partial not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptPartialsHandler] [WARN] Prompt partial ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt partial not found',
        },
        404
      );
    }
    
    // Update partial
    const updateData: Partial<typeof promptPartials.$inferInsert> = {
      updatedAt: new Date(),
    };
    
    if (name !== undefined) updateData.name = name;
    if (template !== undefined) {
      updateData.template = template;
      updateData.version = existing.version + 1; // Increment version on template change
    }
    
    const result = await db
      .update(promptPartials)
      .set(updateData)
      .where(eq(promptPartials.id, id))
      .returning();
    
    const updated = result[0];
    
    console.log(`[${timestamp}] [PromptPartialsHandler] [INFO] Updated prompt partial: ${id}`);
    
    return c.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptPartialsHandler] [ERROR] Failed to update prompt partial:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update prompt partial',
      },
      500
    );
  }
}

/**
 * Delete prompt partial
 * DELETE /v1/admin/prompt-partials/:id
 */
export async function deletePromptPartial(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    // Check if partial exists
    const existing = await db
      .select()
      .from(promptPartials)
      .where(eq(promptPartials.id, id))
      .get();
    
    if (!existing) {
      console.warn(`[${timestamp}] [PromptPartialsHandler] [WARN] Prompt partial not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt partial not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptPartialsHandler] [WARN] Prompt partial ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt partial not found',
        },
        404
      );
    }
    
    await db.delete(promptPartials).where(eq(promptPartials.id, id));
    
    console.log(`[${timestamp}] [PromptPartialsHandler] [INFO] Deleted prompt partial: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'Prompt partial deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptPartialsHandler] [ERROR] Failed to delete prompt partial:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete prompt partial',
      },
      500
    );
  }
}


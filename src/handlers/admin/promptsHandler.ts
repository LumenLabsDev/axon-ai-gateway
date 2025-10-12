import { Context } from 'hono';
import { getDb } from '../../db';
import { prompts, promptVersions, NewPrompt, NewPromptVersion } from '../../db/schema';
import { eq, and, desc } from 'drizzle-orm';

/**
 * List prompts with latest version info
 * GET /v1/admin/prompts
 */
export async function listPrompts(c: Context) {
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
    const allPrompts = await db
      .select()
      .from(prompts)
      .where(eq(prompts.workspaceId, workspace.id));
    
    // Get latest version for each prompt
    const promptsWithVersions = await Promise.all(
      allPrompts.map(async (prompt) => {
        const latestVersion = await db
          .select()
          .from(promptVersions)
          .where(eq(promptVersions.promptId, prompt.id))
          .orderBy(desc(promptVersions.version))
          .limit(1)
          .get();
        
        return {
          ...prompt,
          latestVersion,
        };
      })
    );
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Listed ${promptsWithVersions.length} prompts for workspace ${workspace.id}`);
    
    return c.json({
      status: 'success',
      data: promptsWithVersions,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to list prompts:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list prompts',
      },
      500
    );
  }
}

/**
 * Get prompt with all versions
 * GET /v1/admin/prompts/:id
 */
export async function getPrompt(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    const prompt = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .get();
    
    if (!prompt) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    // Check workspace access
    if (workspace && prompt.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    // Get all versions
    const versions = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, id))
      .orderBy(desc(promptVersions.version));
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Retrieved prompt: ${id} with ${versions.length} versions`);
    
    return c.json({
      status: 'success',
      data: {
        ...prompt,
        versions,
      },
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to get prompt:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get prompt',
      },
      500
    );
  }
}

/**
 * Get specific prompt version
 * GET /v1/admin/prompts/:id/versions/:version
 */
export async function getPromptVersion(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const versionNum = parseInt(c.req.param('version'));
  const workspace = c.get('workspace');
  
  try {
    // Check prompt exists and access
    const prompt = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .get();
    
    if (!prompt) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    if (workspace && prompt.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    // Get specific version
    const version = await db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.promptId, id),
          eq(promptVersions.version, versionNum)
        )
      )
      .get();
    
    if (!version) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt version not found: ${id} v${versionNum}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt version not found',
        },
        404
      );
    }
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Retrieved prompt version: ${id} v${versionNum}`);
    
    return c.json({
      status: 'success',
      data: version,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to get prompt version:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get prompt version',
      },
      500
    );
  }
}

/**
 * Create a new prompt with initial version
 * POST /v1/admin/prompts
 */
export async function createPrompt(c: Context) {
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
    const { name, folder, description, template, variables, params, status } = body;
    
    if (!name || !template) {
      return c.json(
        {
          status: 'failure',
          message: 'Name and template are required',
        },
        400
      );
    }
    
    // Create prompt
    const newPrompt: NewPrompt = {
      workspaceId: workspace.id,
      name,
      folder,
      description,
      createdBy: apiKey?.createdBy,
    };
    
    const promptResult = await db.insert(prompts).values(newPrompt).returning();
    const createdPrompt = promptResult[0];
    
    // Create initial version (v1)
    const newVersion: NewPromptVersion = {
      promptId: createdPrompt.id,
      version: 1,
      template,
      variables,
      params,
      status: status || 'draft',
      createdBy: apiKey?.createdBy,
    };
    
    const versionResult = await db.insert(promptVersions).values(newVersion).returning();
    const createdVersion = versionResult[0];
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Created prompt: ${createdPrompt.id} (${createdPrompt.name}) with v1 in workspace ${workspace.id}`);
    
    return c.json(
      {
        status: 'success',
        data: {
          ...createdPrompt,
          version: createdVersion,
        },
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to create prompt:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create prompt',
      },
      500
    );
  }
}

/**
 * Create a new version of a prompt
 * POST /v1/admin/prompts/:id/versions
 */
export async function createPromptVersion(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  const apiKey = c.get('apiKey');
  
  try {
    const body = await c.req.json();
    const { template, variables, params, status } = body;
    
    if (!template) {
      return c.json(
        {
          status: 'failure',
          message: 'Template is required',
        },
        400
      );
    }
    
    // Check prompt exists
    const prompt = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .get();
    
    if (!prompt) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    if (workspace && prompt.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    // Get latest version number
    const latestVersion = await db
      .select()
      .from(promptVersions)
      .where(eq(promptVersions.promptId, id))
      .orderBy(desc(promptVersions.version))
      .limit(1)
      .get();
    
    const nextVersion = latestVersion ? latestVersion.version + 1 : 1;
    
    // Create new version
    const newVersion: NewPromptVersion = {
      promptId: id,
      version: nextVersion,
      template,
      variables,
      params,
      status: status || 'draft',
      createdBy: apiKey?.createdBy,
    };
    
    const result = await db.insert(promptVersions).values(newVersion).returning();
    const created = result[0];
    
    // Update prompt updatedAt
    await db
      .update(prompts)
      .set({ updatedAt: new Date() })
      .where(eq(prompts.id, id));
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Created prompt version: ${id} v${nextVersion}`);
    
    return c.json(
      {
        status: 'success',
        data: created,
      },
      201
    );
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to create prompt version:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create prompt version',
      },
      500
    );
  }
}

/**
 * Update/publish a prompt version
 * PATCH /v1/admin/prompts/:id/versions/:version
 */
export async function updatePromptVersion(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const versionNum = parseInt(c.req.param('version'));
  const workspace = c.get('workspace');
  
  try {
    const body = await c.req.json();
    const { template, variables, params, status } = body;
    
    // Check prompt exists
    const prompt = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .get();
    
    if (!prompt) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    if (workspace && prompt.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    // Check version exists
    const version = await db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.promptId, id),
          eq(promptVersions.version, versionNum)
        )
      )
      .get();
    
    if (!version) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt version not found: ${id} v${versionNum}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt version not found',
        },
        404
      );
    }
    
    // If publishing to production, unpublish other production versions
    if (status === 'production') {
      await db
        .update(promptVersions)
        .set({ status: 'staging' })
        .where(
          and(
            eq(promptVersions.promptId, id),
            eq(promptVersions.status, 'production')
          )
        );
    }
    
    // Update version
    const updateData: Partial<typeof promptVersions.$inferInsert> = {};
    
    if (template !== undefined) updateData.template = template;
    if (variables !== undefined) updateData.variables = variables;
    if (params !== undefined) updateData.params = params;
    if (status !== undefined) updateData.status = status as 'draft' | 'development' | 'staging' | 'production';
    
    const result = await db
      .update(promptVersions)
      .set(updateData)
      .where(eq(promptVersions.id, version.id))
      .returning();
    
    const updated = result[0];
    
    // Update prompt updatedAt
    await db
      .update(prompts)
      .set({ updatedAt: new Date() })
      .where(eq(prompts.id, id));
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Updated prompt version: ${id} v${versionNum}`);
    
    return c.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to update prompt version:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update prompt version',
      },
      500
    );
  }
}

/**
 * Delete a prompt (and all its versions)
 * DELETE /v1/admin/prompts/:id
 */
export async function deletePrompt(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');
  
  try {
    // Check prompt exists
    const prompt = await db
      .select()
      .from(prompts)
      .where(eq(prompts.id, id))
      .get();
    
    if (!prompt) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt not found: ${id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    if (workspace && prompt.workspaceId !== workspace.id) {
      console.warn(`[${timestamp}] [PromptsHandler] [WARN] Prompt ${id} does not belong to workspace ${workspace.id}`);
      return c.json(
        {
          status: 'failure',
          message: 'Prompt not found',
        },
        404
      );
    }
    
    // Delete prompt (cascade will delete versions)
    await db.delete(prompts).where(eq(prompts.id, id));
    
    console.log(`[${timestamp}] [PromptsHandler] [INFO] Deleted prompt: ${id}`);
    
    return c.json({
      status: 'success',
      message: 'Prompt deleted successfully',
    });
  } catch (error: any) {
    console.error(`[${timestamp}] [PromptsHandler] [ERROR] Failed to delete prompt:`, error.message);
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete prompt',
      },
      500
    );
  }
}


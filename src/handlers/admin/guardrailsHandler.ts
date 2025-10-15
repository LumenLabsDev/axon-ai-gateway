import { Context } from 'hono';
import { getDb } from '../../db';
import {
  guardrails,
  workspaceGuardrails,
  NewGuardrail,
  NewWorkspaceGuardrail,
} from '../../db/schema';
import { eq } from 'drizzle-orm';

/**
 * List guardrails
 * GET /v1/admin/guardrails
 */
export async function listGuardrails(c: Context) {
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
    const allGuardrails = await db
      .select()
      .from(guardrails)
      .where(eq(guardrails.workspaceId, workspace.id));

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Listed ${allGuardrails.length} guardrails for workspace ${workspace.id}`
    );

    return c.json({
      status: 'success',
      data: allGuardrails,
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to list guardrails:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to list guardrails',
      },
      500
    );
  }
}

/**
 * Get guardrail details
 * GET /v1/admin/guardrails/:id
 */
export async function getGuardrail(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');

  try {
    const guardrail = await db
      .select()
      .from(guardrails)
      .where(eq(guardrails.id, id))
      .get();

    if (!guardrail) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail not found: ${id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Check workspace access
    if (workspace && guardrail.workspaceId !== workspace.id) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail ${id} does not belong to workspace ${workspace.id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Get bindings
    const bindings = await db
      .select()
      .from(workspaceGuardrails)
      .where(eq(workspaceGuardrails.guardrailId, id));

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Retrieved guardrail: ${id} with ${bindings.length} bindings`
    );

    return c.json({
      status: 'success',
      data: {
        ...guardrail,
        bindings,
      },
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to get guardrail:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to get guardrail',
      },
      500
    );
  }
}

/**
 * Create a new guardrail
 * POST /v1/admin/guardrails
 */
export async function createGuardrail(c: Context) {
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
    const { name, description, checks, actions, async } = body;

    if (!name || !checks || !Array.isArray(checks)) {
      return c.json(
        {
          status: 'failure',
          message: 'Name and checks array are required',
        },
        400
      );
    }

    // Validate checks format
    for (const check of checks) {
      if (!check.id || !check.parameters) {
        return c.json(
          {
            status: 'failure',
            message: 'Each check must have id and parameters',
          },
          400
        );
      }
    }

    const newGuardrail: NewGuardrail = {
      workspaceId: workspace.id,
      name,
      description,
      checks,
      actions: actions || {},
      async: async || false,
      createdBy: apiKey?.createdBy,
    };

    const result = await db.insert(guardrails).values(newGuardrail).returning();
    const created = result[0];

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Created guardrail: ${created.id} (${created.name}) in workspace ${workspace.id}`
    );

    return c.json(
      {
        status: 'success',
        data: created,
      },
      201
    );
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to create guardrail:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to create guardrail',
      },
      500
    );
  }
}

/**
 * Update guardrail
 * PATCH /v1/admin/guardrails/:id
 */
export async function updateGuardrail(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');

  try {
    const body = await c.req.json();
    const { name, description, checks, actions, async } = body;

    // Check if guardrail exists
    const existing = await db
      .select()
      .from(guardrails)
      .where(eq(guardrails.id, id))
      .get();

    if (!existing) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail not found: ${id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail ${id} does not belong to workspace ${workspace.id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Validate checks if provided
    if (checks && Array.isArray(checks)) {
      for (const check of checks) {
        if (!check.id || !check.parameters) {
          return c.json(
            {
              status: 'failure',
              message: 'Each check must have id and parameters',
            },
            400
          );
        }
      }
    }

    // Update guardrail
    const updateData: Partial<typeof guardrails.$inferInsert> = {
      updatedAt: new Date(),
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (checks !== undefined) updateData.checks = checks;
    if (actions !== undefined) updateData.actions = actions;
    if (async !== undefined) updateData.async = async;

    const result = await db
      .update(guardrails)
      .set(updateData)
      .where(eq(guardrails.id, id))
      .returning();

    const updated = result[0];

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Updated guardrail: ${id}`
    );

    return c.json({
      status: 'success',
      data: updated,
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to update guardrail:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to update guardrail',
      },
      500
    );
  }
}

/**
 * Delete guardrail
 * DELETE /v1/admin/guardrails/:id
 */
export async function deleteGuardrail(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
  const workspace = c.get('workspace');

  try {
    // Check if guardrail exists
    const existing = await db
      .select()
      .from(guardrails)
      .where(eq(guardrails.id, id))
      .get();

    if (!existing) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail not found: ${id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail ${id} does not belong to workspace ${workspace.id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Delete guardrail (cascade will delete bindings)
    await db.delete(guardrails).where(eq(guardrails.id, id));

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Deleted guardrail: ${id}`
    );

    return c.json({
      status: 'success',
      message: 'Guardrail deleted successfully',
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to delete guardrail:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to delete guardrail',
      },
      500
    );
  }
}

/**
 * Bind a guardrail to workspace or API key
 * POST /v1/admin/guardrails/:id/bind
 */
export async function bindGuardrail(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const id = c.req.param('id');
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
    const { apiKeyId, mode } = body;

    // Check if guardrail exists
    const guardrail = await db
      .select()
      .from(guardrails)
      .where(eq(guardrails.id, id))
      .get();

    if (!guardrail) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail not found: ${id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    if (guardrail.workspaceId !== workspace.id) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail ${id} does not belong to workspace ${workspace.id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail not found',
        },
        404
      );
    }

    // Create binding
    const newBinding: NewWorkspaceGuardrail = {
      workspaceId: workspace.id,
      guardrailId: id,
      apiKeyId: apiKeyId || null,
      mode: mode || 'observe',
    };

    const result = await db
      .insert(workspaceGuardrails)
      .values(newBinding)
      .returning();
    const created = result[0];

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Bound guardrail ${id} to ${apiKeyId ? `API key ${apiKeyId}` : `workspace ${workspace.id}`}`
    );

    return c.json(
      {
        status: 'success',
        data: created,
      },
      201
    );
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to bind guardrail:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to bind guardrail',
      },
      500
    );
  }
}

/**
 * Unbind a guardrail
 * DELETE /v1/admin/guardrails/:id/bind/:bindingId
 */
export async function unbindGuardrail(c: Context) {
  const timestamp = new Date().toISOString();
  const db = getDb();
  const bindingId = c.req.param('bindingId');
  const workspace = c.get('workspace');

  try {
    // Check if binding exists
    const existing = await db
      .select()
      .from(workspaceGuardrails)
      .where(eq(workspaceGuardrails.id, bindingId))
      .get();

    if (!existing) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail binding not found: ${bindingId}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail binding not found',
        },
        404
      );
    }

    // Check workspace access
    if (workspace && existing.workspaceId !== workspace.id) {
      console.warn(
        `[${timestamp}] [GuardrailsHandler] [WARN] Guardrail binding ${bindingId} does not belong to workspace ${workspace.id}`
      );
      return c.json(
        {
          status: 'failure',
          message: 'Guardrail binding not found',
        },
        404
      );
    }

    await db
      .delete(workspaceGuardrails)
      .where(eq(workspaceGuardrails.id, bindingId));

    console.log(
      `[${timestamp}] [GuardrailsHandler] [INFO] Unbound guardrail binding: ${bindingId}`
    );

    return c.json({
      status: 'success',
      message: 'Guardrail unbound successfully',
    });
  } catch (error: any) {
    console.error(
      `[${timestamp}] [GuardrailsHandler] [ERROR] Failed to unbind guardrail:`,
      error.message
    );
    return c.json(
      {
        status: 'failure',
        message: 'Failed to unbind guardrail',
      },
      500
    );
  }
}

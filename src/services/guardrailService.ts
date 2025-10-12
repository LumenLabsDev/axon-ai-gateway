import { getDb } from '../db';
import { guardrails, workspaceGuardrails } from '../db/schema';
import { eq, and, or } from 'drizzle-orm';
import { HookObject } from '../middlewares/hooks/types';

/**
 * Guardrail Service
 * Converts database guardrails to HookObjects for execution
 */

/**
 * Get guardrails for a workspace and/or API key
 * @param workspaceId - The workspace ID
 * @param apiKeyId - Optional API key ID for specific bindings
 * @returns Array of guardrails with their execution mode
 */
export async function getGuardrailsForContext(
  workspaceId: string,
  apiKeyId?: string
): Promise<Array<{
  guardrail: typeof guardrails.$inferSelect;
  mode: 'block' | 'observe';
}>> {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    // Build query to get bindings for workspace and optionally for specific API key
    const queryConditions = [eq(workspaceGuardrails.workspaceId, workspaceId)];
    
    if (apiKeyId) {
      // Get bindings for specific API key OR workspace-wide bindings
      queryConditions.push(
        or(
          eq(workspaceGuardrails.apiKeyId, apiKeyId),
          eq(workspaceGuardrails.apiKeyId, null)
        )!
      );
    } else {
      // Only workspace-wide bindings
      queryConditions.push(eq(workspaceGuardrails.apiKeyId, null));
    }
    
    const bindings = await db
      .select()
      .from(workspaceGuardrails)
      .where(and(...queryConditions));
    
    if (bindings.length === 0) {
      return [];
    }
    
    // Get the actual guardrails
    const guardrailIds = bindings.map((b) => b.guardrailId);
    const allGuardrails = await db
      .select()
      .from(guardrails)
      .where(eq(guardrails.workspaceId, workspaceId));
    
    // Filter to bound guardrails and attach mode
    const boundGuardrails = allGuardrails
      .filter((g) => guardrailIds.includes(g.id))
      .map((g) => {
        const binding = bindings.find((b) => b.guardrailId === g.id);
        return {
          guardrail: g,
          mode: binding!.mode,
        };
      });
    
    console.log(
      `[${timestamp}] [GuardrailService] [INFO] Found ${boundGuardrails.length} guardrails for workspace ${workspaceId}${apiKeyId ? ` / API key ${apiKeyId}` : ''}`
    );
    
    return boundGuardrails;
  } catch (error: any) {
    console.error(`[${timestamp}] [GuardrailService] [ERROR] Failed to get guardrails:`, error.message);
    return [];
  }
}

/**
 * Convert a guardrail to HookObjects for execution
 * @param guardrail - The guardrail from database
 * @returns Array of HookObjects (before/after request hooks)
 */
export function guardrailToHooks(guardrail: typeof guardrails.$inferSelect): {
  beforeRequestHooks: HookObject[];
  afterRequestHooks: HookObject[];
} {
  const timestamp = new Date().toISOString();
  
  const beforeRequestHooks: HookObject[] = [];
  const afterRequestHooks: HookObject[] = [];
  
  // Convert each check to a hook
  for (const check of guardrail.checks) {
    if (check.enabled === false) {
      continue; // Skip disabled checks
    }
    
    const hookObject: HookObject = {
      id: check.id,
      parameters: check.parameters || {},
    };
    
    // Add timeout if specified
    if (check.timeout) {
      hookObject.timeout = check.timeout;
    }
    
    // Add inverse if specified
    if (check.inverse) {
      hookObject.parameters.inverse = check.inverse;
    }
    
    // Determine if this is a before or after request hook based on check ID
    // Checks that operate on input go in beforeRequestHooks
    // Checks that operate on output go in afterRequestHooks
    const isOutputCheck = check.id.includes('output') || 
                         check.id.includes('response') ||
                         check.id.includes('scan.response');
    
    if (isOutputCheck) {
      afterRequestHooks.push(hookObject);
    } else {
      beforeRequestHooks.push(hookObject);
    }
  }
  
  // Add actions as callbacks
  if (guardrail.actions) {
    const actions = guardrail.actions as any;
    
    // Add feedback on success
    if (actions.onSuccess?.addFeedback) {
      // This would be handled by the hooks system
      // For now, we can add it as metadata to the hooks
      beforeRequestHooks.forEach((hook) => {
        hook.parameters._guardrailActions = {
          onSuccess: actions.onSuccess,
        };
      });
      afterRequestHooks.forEach((hook) => {
        hook.parameters._guardrailActions = {
          onSuccess: actions.onSuccess,
        };
      });
    }
    
    // Add feedback on failure / deny request
    if (actions.onFailure) {
      beforeRequestHooks.forEach((hook) => {
        hook.parameters._guardrailActions = {
          ...(hook.parameters._guardrailActions || {}),
          onFailure: actions.onFailure,
        };
      });
      afterRequestHooks.forEach((hook) => {
        hook.parameters._guardrailActions = {
          ...(hook.parameters._guardrailActions || {}),
          onFailure: actions.onFailure,
        };
      });
      
      // If denyRequest is true, mark all checks to fail the request
      if (actions.onFailure.denyRequest) {
        beforeRequestHooks.forEach((hook) => {
          hook.parameters.failOnError = true;
        });
        afterRequestHooks.forEach((hook) => {
          hook.parameters.failOnError = true;
        });
      }
    }
  }
  
  console.log(
    `[${timestamp}] [GuardrailService] [INFO] Converted guardrail "${guardrail.name}" to ${beforeRequestHooks.length} before hooks and ${afterRequestHooks.length} after hooks`
  );
  
  return {
    beforeRequestHooks,
    afterRequestHooks,
  };
}

/**
 * Get all hooks for a request context
 * @param workspaceId - The workspace ID
 * @param apiKeyId - Optional API key ID
 * @returns Combined before and after request hooks
 */
export async function getHooksForContext(
  workspaceId: string,
  apiKeyId?: string
): Promise<{
  beforeRequestHooks: HookObject[];
  afterRequestHooks: HookObject[];
}> {
  const guardrailsWithMode = await getGuardrailsForContext(workspaceId, apiKeyId);
  
  const allBeforeHooks: HookObject[] = [];
  const allAfterHooks: HookObject[] = [];
  
  for (const { guardrail, mode } of guardrailsWithMode) {
    const { beforeRequestHooks, afterRequestHooks } = guardrailToHooks(guardrail);
    
    // Add mode to each hook
    beforeRequestHooks.forEach((hook) => {
      hook.parameters._guardrailMode = mode;
    });
    afterRequestHooks.forEach((hook) => {
      hook.parameters._guardrailMode = mode;
    });
    
    allBeforeHooks.push(...beforeRequestHooks);
    allAfterHooks.push(...afterRequestHooks);
  }
  
  return {
    beforeRequestHooks: allBeforeHooks,
    afterRequestHooks: allAfterHooks,
  };
}


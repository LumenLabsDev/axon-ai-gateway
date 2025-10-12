import { getDb } from '../db';
import { guardrails, workspaceGuardrails } from '../db/schema';
import { eq, and, or, isNull } from 'drizzle-orm';
import { HookObject, HookType } from '../middlewares/hooks/types';

/**
 * Guardrail Service
 * Converts database guardrails to HookObjects for execution
 */

/**
 * Get guardrails for a workspace and/or virtual key
 * @param workspaceId - The workspace ID
 * @param virtualKeyId - Optional virtual key ID for specific bindings
 * @returns Array of guardrails with their execution mode
 */
export async function getGuardrailsForContext(
  workspaceId: string,
  virtualKeyId?: string
): Promise<Array<{
  guardrail: typeof guardrails.$inferSelect;
  mode: 'block' | 'observe';
}>> {
  const timestamp = new Date().toISOString();
  const db = getDb();
  
  try {
    // Build query to get bindings for workspace and optionally for specific virtual key
    const queryConditions = [eq(workspaceGuardrails.workspaceId, workspaceId)];
    
    if (virtualKeyId) {
      // Get bindings for specific virtual key OR workspace-wide bindings
      queryConditions.push(
        or(
          eq(workspaceGuardrails.virtualKeyId, virtualKeyId),
          isNull(workspaceGuardrails.virtualKeyId)
        )!
      );
    } else {
      // Only workspace-wide bindings
      queryConditions.push(isNull(workspaceGuardrails.virtualKeyId));
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
      `[${timestamp}] [GuardrailService] [INFO] Found ${boundGuardrails.length} guardrails for workspace ${workspaceId}${virtualKeyId ? ` / virtual key ${virtualKeyId}` : ''}`
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
  
  const beforeChecks: any[] = [];
  const afterChecks: any[] = [];
  
  // Convert each check and categorize
  for (const check of guardrail.checks) {
    if (check.enabled === false) {
      continue; // Skip disabled checks
    }
    
    const checkObject = {
      id: check.id,
      parameters: {
        ...(check.parameters || {}),
        ...(check.inverse ? { inverse: check.inverse } : {}),
        ...(check.timeout ? { timeout: check.timeout } : {}),
      },
      is_enabled: true,
    };
    
    // Determine if this is a before or after request hook based on check ID
    // Checks that operate on input go in beforeRequestHooks
    // Checks that operate on output go in afterRequestHooks
    const isOutputCheck = check.id.includes('output') || 
                         check.id.includes('response') ||
                         check.id.includes('scan.response');
    
    if (isOutputCheck) {
      afterChecks.push(checkObject);
    } else {
      beforeChecks.push(checkObject);
    }
  }
  
  // Create hook objects
  const beforeRequestHooks: HookObject[] = [];
  const afterRequestHooks: HookObject[] = [];
  
  if (beforeChecks.length > 0) {
    const hookObject: HookObject = {
      type: HookType.GUARDRAIL,
      id: `${guardrail.id}-before`,
      checks: beforeChecks,
      async: false,
      deny: false,
      eventType: 'beforeRequestHook',
    };
    
    // Add actions as callbacks
    if (guardrail.actions) {
      const actions = guardrail.actions as any;
      
      if (actions.onSuccess) {
        hookObject.onSuccess = { feedback: actions.onSuccess };
      }
      
      if (actions.onFailure) {
        hookObject.onFail = { feedback: actions.onFailure };
        
        // If denyRequest is true, mark to fail the request
        if (actions.onFailure.denyRequest) {
          hookObject.deny = true;
        }
      }
    }
    
    beforeRequestHooks.push(hookObject);
  }
  
  if (afterChecks.length > 0) {
    const hookObject: HookObject = {
      type: HookType.GUARDRAIL,
      id: `${guardrail.id}-after`,
      checks: afterChecks,
      async: false,
      deny: false,
      eventType: 'afterRequestHook',
    };
    
    // Add actions as callbacks
    if (guardrail.actions) {
      const actions = guardrail.actions as any;
      
      if (actions.onSuccess) {
        hookObject.onSuccess = { feedback: actions.onSuccess };
      }
      
      if (actions.onFailure) {
        hookObject.onFail = { feedback: actions.onFailure };
        
        // If denyRequest is true, mark to fail the request
        if (actions.onFailure.denyRequest) {
          hookObject.deny = true;
        }
      }
    }
    
    afterRequestHooks.push(hookObject);
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
 * @param virtualKeyId - Optional virtual key ID
 * @returns Combined before and after request hooks
 */
export async function getHooksForContext(
  workspaceId: string,
  virtualKeyId?: string
): Promise<{
  beforeRequestHooks: HookObject[];
  afterRequestHooks: HookObject[];
}> {
  const guardrailsWithMode = await getGuardrailsForContext(workspaceId, virtualKeyId);
  
  const allBeforeHooks: HookObject[] = [];
  const allAfterHooks: HookObject[] = [];
  
  for (const { guardrail, mode } of guardrailsWithMode) {
    const { beforeRequestHooks, afterRequestHooks } = guardrailToHooks(guardrail);
    
    // Add mode to each hook's checks
    beforeRequestHooks.forEach((hook) => {
      if (hook.checks) {
        hook.checks.forEach((check) => {
          (check.parameters as any)._guardrailMode = mode;
        });
      }
    });
    afterRequestHooks.forEach((hook) => {
      if (hook.checks) {
        hook.checks.forEach((check) => {
          (check.parameters as any)._guardrailMode = mode;
        });
      }
    });
    
    allBeforeHooks.push(...beforeRequestHooks);
    allAfterHooks.push(...afterRequestHooks);
  }
  
  return {
    beforeRequestHooks: allBeforeHooks,
    afterRequestHooks: allAfterHooks,
  };
}


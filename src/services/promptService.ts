import { getDb } from '../db';
import { prompts, promptVersions, promptPartials } from '../db/schema';
import { eq, and } from 'drizzle-orm';
import Mustache from 'mustache';

/**
 * Prompt Resolution Service
 * Resolves prompt templates with variables and partials
 */

interface ResolvedPrompt {
  messages?: Array<{
    role: string;
    content: string;
  }>;
  prompt?: string;
  params?: Record<string, any>;
}

/**
 * Resolve a prompt template with variables
 * @param workspaceId - The workspace ID
 * @param promptId - The prompt ID or name
 * @param variables - Variables to substitute
 * @param version - Optional specific version number (defaults to production)
 * @returns Resolved prompt
 */
export async function resolvePrompt(
  workspaceId: string,
  promptId: string,
  variables: Record<string, any> = {},
  version?: number
): Promise<ResolvedPrompt> {
  const timestamp = new Date().toISOString();
  const db = getDb();

  try {
    // Get prompt by ID or name
    const prompt = await db
      .select()
      .from(prompts)
      .where(
        and(eq(prompts.workspaceId, workspaceId), eq(prompts.id, promptId))
      )
      .get();

    if (!prompt) {
      // Try by name
      const promptByName = await db
        .select()
        .from(prompts)
        .where(
          and(eq(prompts.workspaceId, workspaceId), eq(prompts.name, promptId))
        )
        .get();

      if (!promptByName) {
        throw new Error(`Prompt not found: ${promptId}`);
      }

      return resolvePromptById(
        workspaceId,
        promptByName.id,
        variables,
        version
      );
    }

    return resolvePromptById(workspaceId, prompt.id, variables, version);
  } catch (error: any) {
    console.error(
      `[${timestamp}] [PromptService] [ERROR] Failed to resolve prompt:`,
      error.message
    );
    throw error;
  }
}

/**
 * Internal function to resolve prompt by ID
 */
async function resolvePromptById(
  workspaceId: string,
  promptId: string,
  variables: Record<string, any> = {},
  version?: number
): Promise<ResolvedPrompt> {
  const timestamp = new Date().toISOString();
  const db = getDb();

  // Get prompt version
  let promptVersion;

  if (version !== undefined) {
    // Get specific version
    promptVersion = await db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.promptId, promptId),
          eq(promptVersions.version, version)
        )
      )
      .get();
  } else {
    // Get production version
    promptVersion = await db
      .select()
      .from(promptVersions)
      .where(
        and(
          eq(promptVersions.promptId, promptId),
          eq(promptVersions.status, 'production')
        )
      )
      .get();
  }

  if (!promptVersion) {
    throw new Error(
      `No ${version !== undefined ? `version ${version}` : 'production version'} found for prompt: ${promptId}`
    );
  }

  console.log(
    `[${timestamp}] [PromptService] [INFO] Resolving prompt ${promptId} version ${promptVersion.version}`
  );

  // Get all partials for this workspace
  const allPartials = await db
    .select()
    .from(promptPartials)
    .where(eq(promptPartials.workspaceId, workspaceId));

  // Create partials map
  const partialsMap: Record<string, string> = {};
  for (const partial of allPartials) {
    partialsMap[partial.name] = partial.template;
  }

  // Merge with variables
  const context = {
    ...variables,
    ...(promptVersion.variables || {}),
  };

  // Parse template
  let template = promptVersion.template;
  let resolved: ResolvedPrompt = {};

  try {
    // Try to parse as JSON (for messages format)
    const parsed = JSON.parse(template);

    if (Array.isArray(parsed)) {
      // Messages format
      resolved.messages = parsed.map((msg: any) => {
        if (typeof msg.content === 'string') {
          return {
            ...msg,
            content: Mustache.render(msg.content, context, partialsMap),
          };
        }
        return msg;
      });
    } else if (parsed.messages) {
      // Object with messages
      resolved.messages = parsed.messages.map((msg: any) => {
        if (typeof msg.content === 'string') {
          return {
            ...msg,
            content: Mustache.render(msg.content, context, partialsMap),
          };
        }
        return msg;
      });
    } else if (parsed.prompt) {
      // Object with prompt
      resolved.prompt = Mustache.render(parsed.prompt, context, partialsMap);
    } else {
      // Fallback: render whole JSON as string
      const rendered = Mustache.render(template, context, partialsMap);
      resolved = JSON.parse(rendered);
    }
  } catch {
    // Not JSON, treat as plain text prompt
    resolved.prompt = Mustache.render(template, context, partialsMap);
  }

  // Add params if present
  if (promptVersion.params) {
    resolved.params = promptVersion.params;
  }

  return resolved;
}

/**
 * Get all partials for a workspace
 */
export async function getWorkspacePartials(
  workspaceId: string
): Promise<Record<string, string>> {
  const db = getDb();

  const allPartials = await db
    .select()
    .from(promptPartials)
    .where(eq(promptPartials.workspaceId, workspaceId));

  const partialsMap: Record<string, string> = {};
  for (const partial of allPartials) {
    partialsMap[partial.name] = partial.template;
  }

  return partialsMap;
}

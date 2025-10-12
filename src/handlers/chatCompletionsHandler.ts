import { RouterError } from '../errors/RouterError';
import {
  constructConfigFromRequestHeaders,
  tryTargetsRecursively,
} from './handlerUtils';
import { Context } from 'hono';
import { resolvePrompt } from '../services/promptService';

/**
 * Handles the '/chat/completions' API request by selecting the appropriate provider(s) and making the request to them.
 * If the route is /v1/prompts/:id/completions, resolves the prompt template first.
 *
 * @param {Context} c - The Cloudflare Worker context.
 * @returns {Promise<Response>} - The response from the provider.
 * @throws Will throw an error if no provider options can be determined or if the request to the provider(s) fails.
 * @throws Will throw an 500 error if the handler fails due to some reasons
 */
export async function chatCompletionsHandler(c: Context): Promise<Response> {
  try {
    let request = await c.req.json();
    let requestHeaders = Object.fromEntries(c.req.raw.headers);
    
    // Check if this is a prompt completion request
    const url = new URL(c.req.url);
    const promptMatch = url.pathname.match(/\/v1\/prompts\/([^\/]+)\//);
    
    if (promptMatch) {
      const promptId = promptMatch[1];
      const workspace = c.get('workspace');
      
      if (!workspace) {
        return new Response(
          JSON.stringify({
            status: 'failure',
            message: 'Workspace context required for prompt completion',
          }),
          {
            status: 400,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }
      
      try {
        // Get variables from request body
        const variables = request.variables || {};
        const version = request.version;
        
        // Resolve prompt
        const resolved = await resolvePrompt(workspace.id, promptId, variables, version);
        
        // Merge resolved prompt into request
        if (resolved.messages) {
          request.messages = resolved.messages;
        } else if (resolved.prompt) {
          // Convert prompt to messages format
          request.messages = [
            {
              role: 'user',
              content: resolved.prompt,
            },
          ];
        }
        
        // Merge params if provided
        if (resolved.params) {
          request = { ...resolved.params, ...request };
        }
        
        console.log(`Resolved prompt ${promptId} for workspace ${workspace.id}`);
      } catch (error: any) {
        console.error('Failed to resolve prompt:', error);
        return new Response(
          JSON.stringify({
            status: 'failure',
            message: `Failed to resolve prompt: ${error.message}`,
          }),
          {
            status: 400,
            headers: {
              'content-type': 'application/json',
            },
          }
        );
      }
    }
    
    const camelCaseConfig = constructConfigFromRequestHeaders(requestHeaders, c);
    const tryTargetsResponse = await tryTargetsRecursively(
      c,
      camelCaseConfig ?? {},
      request,
      requestHeaders,
      'chatComplete',
      'POST',
      'config'
    );

    return tryTargetsResponse;
  } catch (err: any) {
    console.error('chatCompletionsHandler error: ', err);
    let statusCode = 500;
    let errorMessage = 'Something went wrong';

    if (err instanceof RouterError) {
      statusCode = 400;
      errorMessage = err.message;
    }

    return new Response(
      JSON.stringify({
        status: 'failure',
        message: errorMessage,
      }),
      {
        status: statusCode,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}

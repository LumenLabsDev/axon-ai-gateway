/**
 * Axon AI Gateway
 *
 * @module index
 */

import { Context, Hono } from 'hono';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import { compress } from 'hono/compress';
import { getRuntimeKey } from 'hono/adapter';
// import { env } from 'hono/adapter' // Have to set this up for multi-environment deployment

// Middlewares
import { requestValidator } from './middlewares/requestValidator';
import { hooks } from './middlewares/hooks';
import { memoryCache } from './middlewares/cache';

// Handlers
import { proxyHandler } from './handlers/proxyHandler';
import { chatCompletionsHandler } from './handlers/chatCompletionsHandler';
import { completionsHandler } from './handlers/completionsHandler';
import { embeddingsHandler } from './handlers/embeddingsHandler';
import { logger } from './middlewares/log';
import { imageGenerationsHandler } from './handlers/imageGenerationsHandler';
import { createSpeechHandler } from './handlers/createSpeechHandler';
import { createTranscriptionHandler } from './handlers/createTranscriptionHandler';
import { createTranslationHandler } from './handlers/createTranslationHandler';
import { modelsHandler } from './handlers/modelsHandler';
import { realTimeHandler } from './handlers/realtimeHandler';
import filesHandler from './handlers/filesHandler';
import batchesHandler from './handlers/batchesHandler';
import finetuneHandler from './handlers/finetuneHandler';
import { messagesHandler } from './handlers/messagesHandler';
import { imageEditsHandler } from './handlers/imageEditsHandler';

// Config
import conf from '../conf.json';
import modelResponsesHandler from './handlers/modelResponsesHandler';
import { messagesCountTokensHandler } from './handlers/messagesCountTokensHandler';

// Create a new Hono server instance
const app = new Hono();
/**
 * Middleware that conditionally applies compression middleware based on the runtime.
 * Compression is automatically handled for lagon and workerd runtimes
 * This check if its not any of the 2 and then applies the compress middleware to avoid double compression.
 */

const runtime = getRuntimeKey();
app.use('*', (c, next) => {
  const runtimesThatDontNeedCompression = ['lagon', 'workerd', 'node'];
  if (runtimesThatDontNeedCompression.includes(runtime)) {
    return next();
  }
  return compress()(c, next);
});

if (runtime === 'node') {
  app.use('*', async (c: Context, next) => {
    if (!c.req.url.includes('/realtime')) {
      return next();
    }

    await next();

    if (
      c.req.url.includes('/realtime') &&
      c.req.header('upgrade') === 'websocket' &&
      (c.res.status >= 400 || c.get('websocketError') === true)
    ) {
      const finalStatus = c.get('websocketError') === true ? 500 : c.res.status;
      const socket = c.env.incoming.socket;
      if (socket) {
        socket.write(`HTTP/1.1 ${finalStatus} ${c.res.statusText}\r\n\r\n`);
        socket.destroy();
      }
    }
  });
}

/**
 * GET route for the root path.
 * Returns a greeting message.
 */
app.get('/', (c) => c.text('AI Gateway says hey!'));

// Use prettyJSON middleware for all routes
app.use('*', prettyJSON());

// Use logger middleware for all routes
if (getRuntimeKey() === 'node') {
  app.use(logger());
}

// Support the /v1/models endpoint
app.get('/v1/models', modelsHandler);

// Use hooks middleware for all routes
app.use('*', hooks);

if (conf.cache === true) {
  app.use('*', memoryCache());
}

// Use API key authentication middleware for all /v1/* routes
import { apiKeyAuth, requireAuth, requirePermission } from './middlewares/apiKeyAuth';
app.use('/v1/*', apiKeyAuth);

// Admin routes
import * as workspacesHandler from './handlers/admin/workspacesHandler';
import * as usersHandler from './handlers/admin/usersHandler';
import * as providerKeysHandler from './handlers/admin/providerKeysHandler';
import * as apiKeysHandler from './handlers/admin/apiKeysHandler';
import * as promptsHandler from './handlers/admin/promptsHandler';
import * as promptPartialsHandler from './handlers/admin/promptPartialsHandler';
import * as guardrailsHandler from './handlers/admin/guardrailsHandler';

// Workspaces
app.get('/v1/admin/workspaces', requireAuth, requirePermission('workspaces.read'), workspacesHandler.listWorkspaces);
app.post('/v1/admin/workspaces', requireAuth, requirePermission('workspaces.write'), workspacesHandler.createWorkspace);
app.get('/v1/admin/workspaces/:id', requireAuth, requirePermission('workspaces.read'), workspacesHandler.getWorkspace);
app.patch('/v1/admin/workspaces/:id', requireAuth, requirePermission('workspaces.write'), workspacesHandler.updateWorkspace);

// Users
app.get('/v1/admin/users', requireAuth, requirePermission('users.read'), usersHandler.listUsers);
app.post('/v1/admin/users', requireAuth, requirePermission('users.write'), usersHandler.createUser);
app.get('/v1/admin/users/:id', requireAuth, requirePermission('users.read'), usersHandler.getUser);
app.patch('/v1/admin/users/:id', requireAuth, requirePermission('users.write'), usersHandler.updateUser);
app.delete('/v1/admin/users/:id', requireAuth, requirePermission('users.write'), usersHandler.deleteUser);

// Provider Keys
app.get('/v1/admin/provider-keys', requireAuth, requirePermission('provider_keys.read'), providerKeysHandler.listProviderKeys);
app.post('/v1/admin/provider-keys', requireAuth, requirePermission('provider_keys.write'), providerKeysHandler.createProviderKey);
app.get('/v1/admin/provider-keys/:id', requireAuth, requirePermission('provider_keys.read'), providerKeysHandler.getProviderKey);
app.patch('/v1/admin/provider-keys/:id', requireAuth, requirePermission('provider_keys.write'), providerKeysHandler.updateProviderKey);
app.delete('/v1/admin/provider-keys/:id', requireAuth, requirePermission('provider_keys.write'), providerKeysHandler.deleteProviderKey);

// API Keys
app.get('/v1/admin/api-keys', requireAuth, requirePermission('api_keys.read'), apiKeysHandler.listApiKeys);
app.post('/v1/admin/api-keys', requireAuth, requirePermission('api_keys.write'), apiKeysHandler.createApiKey);
app.get('/v1/admin/api-keys/:id', requireAuth, requirePermission('api_keys.read'), apiKeysHandler.getApiKey);
app.patch('/v1/admin/api-keys/:id', requireAuth, requirePermission('api_keys.write'), apiKeysHandler.updateApiKey);
app.delete('/v1/admin/api-keys/:id', requireAuth, requirePermission('api_keys.write'), apiKeysHandler.deleteApiKey);

// Prompts
app.get('/v1/admin/prompts', requireAuth, requirePermission('prompts.read'), promptsHandler.listPrompts);
app.post('/v1/admin/prompts', requireAuth, requirePermission('prompts.write'), promptsHandler.createPrompt);
app.get('/v1/admin/prompts/:id', requireAuth, requirePermission('prompts.read'), promptsHandler.getPrompt);
app.get('/v1/admin/prompts/:id/versions/:version', requireAuth, requirePermission('prompts.read'), promptsHandler.getPromptVersion);
app.post('/v1/admin/prompts/:id/versions', requireAuth, requirePermission('prompts.write'), promptsHandler.createPromptVersion);
app.patch('/v1/admin/prompts/:id/versions/:version', requireAuth, requirePermission('prompts.write'), promptsHandler.updatePromptVersion);
app.delete('/v1/admin/prompts/:id', requireAuth, requirePermission('prompts.write'), promptsHandler.deletePrompt);

// Prompt Partials
app.get('/v1/admin/prompt-partials', requireAuth, requirePermission('prompts.read'), promptPartialsHandler.listPromptPartials);
app.post('/v1/admin/prompt-partials', requireAuth, requirePermission('prompts.write'), promptPartialsHandler.createPromptPartial);
app.get('/v1/admin/prompt-partials/:id', requireAuth, requirePermission('prompts.read'), promptPartialsHandler.getPromptPartial);
app.patch('/v1/admin/prompt-partials/:id', requireAuth, requirePermission('prompts.write'), promptPartialsHandler.updatePromptPartial);
app.delete('/v1/admin/prompt-partials/:id', requireAuth, requirePermission('prompts.write'), promptPartialsHandler.deletePromptPartial);

// Guardrails
app.get('/v1/admin/guardrails', requireAuth, requirePermission('guardrails.read'), guardrailsHandler.listGuardrails);
app.post('/v1/admin/guardrails', requireAuth, requirePermission('guardrails.write'), guardrailsHandler.createGuardrail);
app.get('/v1/admin/guardrails/:id', requireAuth, requirePermission('guardrails.read'), guardrailsHandler.getGuardrail);
app.patch('/v1/admin/guardrails/:id', requireAuth, requirePermission('guardrails.write'), guardrailsHandler.updateGuardrail);
app.delete('/v1/admin/guardrails/:id', requireAuth, requirePermission('guardrails.write'), guardrailsHandler.deleteGuardrail);
app.post('/v1/admin/guardrails/:id/bind', requireAuth, requirePermission('guardrails.write'), guardrailsHandler.bindGuardrail);
app.delete('/v1/admin/guardrails/:id/bind/:bindingId', requireAuth, requirePermission('guardrails.write'), guardrailsHandler.unbindGuardrail);

/**
 * Default route when no other route matches.
 * Returns a JSON response with a message and status code 404.
 */
app.notFound((c) => c.json({ message: 'Not Found', ok: false }, 404));

/**
 * Global error handler.
 * If error is instance of HTTPException, returns the custom response.
 * Otherwise, logs the error and returns a JSON response with status code 500.
 */
app.onError((err, c) => {
  console.error('Global Error Handler: ', err.message, err.cause, err.stack);
  if (err instanceof HTTPException) {
    return err.getResponse();
  }
  c.status(500);
  return c.json({ status: 'failure', message: err.message });
});

/**
 * POST route for '/v1/messages' in anthropic format
 */
app.post('/v1/messages', requestValidator, messagesHandler);

app.post(
  '/v1/messages/count_tokens',
  requestValidator,
  messagesCountTokensHandler
);

/**
 * POST route for '/v1/chat/completions'.
 * Handles requests by passing them to the chatCompletionsHandler.
 */
app.post('/v1/chat/completions', requestValidator, chatCompletionsHandler);

/**
 * POST route for '/v1/completions'.
 * Handles requests by passing them to the completionsHandler.
 */
app.post('/v1/completions', requestValidator, completionsHandler);

/**
 * POST route for '/v1/embeddings'.
 * Handles requests by passing them to the embeddingsHandler.
 */
app.post('/v1/embeddings', requestValidator, embeddingsHandler);

/**
 * POST route for '/v1/images/generations'.
 * Handles requests by passing them to the imageGenerations handler.
 */
app.post('/v1/images/generations', requestValidator, imageGenerationsHandler);

/**
 * POST route for '/v1/images/edits'.
 * Handles requests by passing them to the imageGenerations handler.
 */
app.post('/v1/images/edits', requestValidator, imageEditsHandler);

/**
 * POST route for '/v1/audio/speech'.
 * Handles requests by passing them to the createSpeechHandler.
 */
app.post('/v1/audio/speech', requestValidator, createSpeechHandler);

/**
 * POST route for '/v1/audio/transcriptions'.
 * Handles requests by passing them to the createTranscriptionHandler.
 */
app.post(
  '/v1/audio/transcriptions',
  requestValidator,
  createTranscriptionHandler
);

/**
 * POST route for '/v1/audio/translations'.
 * Handles requests by passing them to the createTranslationHandler.
 */
app.post('/v1/audio/translations', requestValidator, createTranslationHandler);

// files
app.get('/v1/files', requestValidator, filesHandler('listFiles', 'GET'));
app.get('/v1/files/:id', requestValidator, filesHandler('retrieveFile', 'GET'));
app.get(
  '/v1/files/:id/content',
  requestValidator,
  filesHandler('retrieveFileContent', 'GET')
);
app.post('/v1/files', requestValidator, filesHandler('uploadFile', 'POST'));
app.delete(
  '/v1/files/:id',
  requestValidator,
  filesHandler('deleteFile', 'DELETE')
);

// batches
app.post(
  '/v1/batches',
  requestValidator,
  batchesHandler('createBatch', 'POST')
);
app.get(
  '/v1/batches/:id',
  requestValidator,
  batchesHandler('retrieveBatch', 'GET')
);
app.get(
  '/v1/batches/*/output',
  requestValidator,
  batchesHandler('getBatchOutput', 'GET')
);
app.post(
  '/v1/batches/:id/cancel',
  requestValidator,
  batchesHandler('cancelBatch', 'POST')
);
app.get('/v1/batches', requestValidator, batchesHandler('listBatches', 'GET'));

// responses
app.post(
  '/v1/responses',
  requestValidator,
  modelResponsesHandler('createModelResponse', 'POST')
);
app.get(
  '/v1/responses/:id',
  requestValidator,
  modelResponsesHandler('getModelResponse', 'GET')
);
app.delete(
  '/v1/responses/:id',
  requestValidator,
  modelResponsesHandler('deleteModelResponse', 'DELETE')
);
app.get(
  '/v1/responses/:id/input_items',
  requestValidator,
  modelResponsesHandler('listResponseInputItems', 'GET')
);

app.all(
  '/v1/fine_tuning/jobs/:jobId?/:cancel?',
  requestValidator,
  finetuneHandler
);

/**
 * POST route for '/v1/prompts/:id/completions'.
 * Handles axon prompt completions route
 */
app.post('/v1/prompts/*', requestValidator, (c) => {
  if (c.req.url.endsWith('/v1/chat/completions')) {
    return chatCompletionsHandler(c);
  } else if (c.req.url.endsWith('/v1/completions')) {
    return completionsHandler(c);
  }
  c.status(500);
  return c.json({
    status: 'failure',
    message: 'prompt completions error: Something went wrong',
  });
});

// WebSocket route
if (runtime === 'workerd') {
  app.get('/v1/realtime', realTimeHandler);
}

/**
 * @deprecated
 * Support the /v1 proxy endpoint
 */
app.post('/v1/proxy/*', proxyHandler);

// Support the /v1 proxy endpoint after all defined endpoints so this does not interfere.
app.post('/v1/*', requestValidator, proxyHandler);

// Support the /v1 proxy endpoint after all defined endpoints so this does not interfere.
app.get('/v1/:path{(?!realtime).*}', requestValidator, proxyHandler);

app.delete('/v1/*', requestValidator, proxyHandler);

// Export the app
export default app;

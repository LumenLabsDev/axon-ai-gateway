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
 * Redirects to admin dashboard.
 */
app.get('/', (c) => c.redirect('/public/'));

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

// Import authentication middlewares
import { adminKeyAuth } from './middlewares/adminKeyAuth';
import {
  virtualKeyAuth,
  validateRequestedModel,
} from './middlewares/virtualKeyAuth';
import { workspaceContext } from './middlewares/workspaceContext';
import { workspaceAuth } from './middlewares/workspaceAuth';
import { usageTracking } from './middlewares/usageTracking';

// Admin routes - use admin key authentication
import * as workspacesHandler from './handlers/admin/workspacesHandler';
import * as usersHandler from './handlers/admin/usersHandler';
import * as providerKeysHandler from './handlers/admin/providerKeysHandler';
import * as adminKeysHandler from './handlers/admin/adminKeysHandler';
import * as virtualKeysHandler from './handlers/admin/virtualKeysHandler';
import * as promptsHandler from './handlers/admin/promptsHandler';
import * as promptPartialsHandler from './handlers/admin/promptPartialsHandler';
import * as guardrailsHandler from './handlers/admin/guardrailsHandler';
import * as analyticsHandler from './handlers/admin/analyticsHandler';
import * as logsHandler from './handlers/admin/logsHandler';

// Admin Keys (admin authentication for admin panel)
app.get(
  '/v1/admin/admin-keys',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  adminKeysHandler.listAdminKeys
);
app.post(
  '/v1/admin/admin-keys',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  adminKeysHandler.createAdminKey
);
app.get(
  '/v1/admin/admin-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  adminKeysHandler.getAdminKey
);
app.patch(
  '/v1/admin/admin-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  adminKeysHandler.updateAdminKey
);
app.delete(
  '/v1/admin/admin-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  adminKeysHandler.deleteAdminKey
);

app.get(
  '/v1/admin/logs',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  logsHandler.listLogs
);
app.get(
  '/v1/admin/logs/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  logsHandler.getLog
);

// Workspaces (list and create are global operations, others need workspace auth)
app.get(
  '/v1/admin/workspaces',
  adminKeyAuth,
  workspaceContext,
  workspacesHandler.listWorkspaces
);
app.post(
  '/v1/admin/workspaces',
  adminKeyAuth,
  workspaceContext,
  workspacesHandler.createWorkspace
);
app.get(
  '/v1/admin/workspaces/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  workspacesHandler.getWorkspace
);
app.patch(
  '/v1/admin/workspaces/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  workspacesHandler.updateWorkspace
);
app.delete(
  '/v1/admin/workspaces/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  workspacesHandler.deleteWorkspace
);

// Users
app.get(
  '/v1/admin/users',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  usersHandler.listUsers
);
app.post(
  '/v1/admin/users',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  usersHandler.createUser
);
app.get(
  '/v1/admin/users/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  usersHandler.getUser
);
app.patch(
  '/v1/admin/users/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  usersHandler.updateUser
);
app.delete(
  '/v1/admin/users/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  usersHandler.deleteUser
);

// Provider Keys
app.get(
  '/v1/admin/provider-keys',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  providerKeysHandler.listProviderKeys
);
app.post(
  '/v1/admin/provider-keys',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  providerKeysHandler.createProviderKey
);
app.get(
  '/v1/admin/provider-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  providerKeysHandler.getProviderKey
);
app.patch(
  '/v1/admin/provider-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  providerKeysHandler.updateProviderKey
);
app.delete(
  '/v1/admin/provider-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  providerKeysHandler.deleteProviderKey
);

// Virtual Keys (gateway access with rate limits)
app.get(
  '/v1/admin/virtual-keys',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  virtualKeysHandler.listVirtualKeys
);
app.post(
  '/v1/admin/virtual-keys',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  virtualKeysHandler.createVirtualKey
);
app.get(
  '/v1/admin/virtual-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  virtualKeysHandler.getVirtualKey
);
app.patch(
  '/v1/admin/virtual-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  virtualKeysHandler.updateVirtualKey
);
app.delete(
  '/v1/admin/virtual-keys/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  virtualKeysHandler.deleteVirtualKey
);

// Prompts
app.get(
  '/v1/admin/prompts',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.listPrompts
);
app.post(
  '/v1/admin/prompts',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.createPrompt
);
app.get(
  '/v1/admin/prompts/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.getPrompt
);
app.get(
  '/v1/admin/prompts/:id/versions/:version',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.getPromptVersion
);
app.post(
  '/v1/admin/prompts/:id/versions',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.createPromptVersion
);
app.patch(
  '/v1/admin/prompts/:id/versions/:version',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.updatePromptVersion
);
app.delete(
  '/v1/admin/prompts/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptsHandler.deletePrompt
);

// Prompt Partials
app.get(
  '/v1/admin/prompt-partials',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptPartialsHandler.listPromptPartials
);
app.post(
  '/v1/admin/prompt-partials',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptPartialsHandler.createPromptPartial
);
app.get(
  '/v1/admin/prompt-partials/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptPartialsHandler.getPromptPartial
);
app.patch(
  '/v1/admin/prompt-partials/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptPartialsHandler.updatePromptPartial
);
app.delete(
  '/v1/admin/prompt-partials/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  promptPartialsHandler.deletePromptPartial
);

// Guardrails
app.get(
  '/v1/admin/guardrails',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.listGuardrails
);
app.post(
  '/v1/admin/guardrails',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.createGuardrail
);
app.get(
  '/v1/admin/guardrails/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.getGuardrail
);
app.patch(
  '/v1/admin/guardrails/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.updateGuardrail
);
app.delete(
  '/v1/admin/guardrails/:id',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.deleteGuardrail
);
app.post(
  '/v1/admin/guardrails/:id/bind',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.bindGuardrail
);
app.delete(
  '/v1/admin/guardrails/:id/bind/:bindingId',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  guardrailsHandler.unbindGuardrail
);

// Analytics
app.get(
  '/v1/admin/analytics',
  adminKeyAuth,
  workspaceContext,
  workspaceAuth,
  analyticsHandler.getAnalytics
);

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
 * AI/Gateway routes - use virtual key authentication
 */

/**
 * POST route for '/v1/messages' in anthropic format
 */
app.post(
  '/v1/messages',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  messagesHandler
);

app.post(
  '/v1/messages/count_tokens',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  messagesCountTokensHandler
);

/**
 * POST route for '/v1/chat/completions'.
 * Handles requests by passing them to the chatCompletionsHandler.
 */
app.post(
  '/v1/chat/completions',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  chatCompletionsHandler
);

/**
 * POST route for '/v1/completions'.
 * Handles requests by passing them to the completionsHandler.
 */
app.post(
  '/v1/completions',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  completionsHandler
);

/**
 * POST route for '/v1/embeddings'.
 * Handles requests by passing them to the embeddingsHandler.
 */
app.post(
  '/v1/embeddings',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  embeddingsHandler
);

/**
 * POST route for '/v1/images/generations'.
 * Handles requests by passing them to the imageGenerations handler.
 */
app.post(
  '/v1/images/generations',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  imageGenerationsHandler
);

/**
 * POST route for '/v1/images/edits'.
 * Handles requests by passing them to the imageGenerations handler.
 */
app.post(
  '/v1/images/edits',
  virtualKeyAuth,
  validateRequestedModel,
  requestValidator,
  usageTracking,
  imageEditsHandler
);

/**
 * POST route for '/v1/audio/speech'.
 * Handles requests by passing them to the createSpeechHandler.
 */
app.post(
  '/v1/audio/speech',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  createSpeechHandler
);

/**
 * POST route for '/v1/audio/transcriptions'.
 * Handles requests by passing them to the createTranscriptionHandler.
 */
app.post(
  '/v1/audio/transcriptions',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  createTranscriptionHandler
);

/**
 * POST route for '/v1/audio/translations'.
 * Handles requests by passing them to the createTranslationHandler.
 */
app.post(
  '/v1/audio/translations',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  createTranslationHandler
);

// files
app.get(
  '/v1/files',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  filesHandler('listFiles', 'GET')
);
app.get(
  '/v1/files/:id',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  filesHandler('retrieveFile', 'GET')
);
app.get(
  '/v1/files/:id/content',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  filesHandler('retrieveFileContent', 'GET')
);
app.post(
  '/v1/files',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  filesHandler('uploadFile', 'POST')
);
app.delete(
  '/v1/files/:id',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  filesHandler('deleteFile', 'DELETE')
);

// batches
app.post(
  '/v1/batches',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  batchesHandler('createBatch', 'POST')
);
app.get(
  '/v1/batches/:id',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  batchesHandler('retrieveBatch', 'GET')
);
app.get(
  '/v1/batches/*/output',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  batchesHandler('getBatchOutput', 'GET')
);
app.post(
  '/v1/batches/:id/cancel',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  batchesHandler('cancelBatch', 'POST')
);
app.get(
  '/v1/batches',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  batchesHandler('listBatches', 'GET')
);

// responses
app.post(
  '/v1/responses',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  modelResponsesHandler('createModelResponse', 'POST')
);
app.get(
  '/v1/responses/:id',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  modelResponsesHandler('getModelResponse', 'GET')
);
app.delete(
  '/v1/responses/:id',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  modelResponsesHandler('deleteModelResponse', 'DELETE')
);
app.get(
  '/v1/responses/:id/input_items',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  modelResponsesHandler('listResponseInputItems', 'GET')
);

app.all(
  '/v1/fine_tuning/jobs/:jobId?/:cancel?',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  finetuneHandler
);

/**
 * POST route for '/v1/prompts/:id/completions'.
 * Handles axon prompt completions route
 */
app.post(
  '/v1/prompts/*',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  (c) => {
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
  }
);

// WebSocket route
if (runtime === 'workerd') {
  app.get('/v1/realtime', realTimeHandler);
}

/**
 * @deprecated
 * Support the /v1 proxy endpoint
 */
app.post('/v1/proxy/*', virtualKeyAuth, usageTracking, proxyHandler);

// Support the /v1 proxy endpoint after all defined endpoints so this does not interfere.
app.post(
  '/v1/*',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  proxyHandler
);

// Support the /v1 proxy endpoint after all defined endpoints so this does not interfere.
app.get(
  '/v1/:path{(?!realtime).*}',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  proxyHandler
);

app.delete(
  '/v1/*',
  virtualKeyAuth,
  requestValidator,
  usageTracking,
  proxyHandler
);

// Export the app
export default app;

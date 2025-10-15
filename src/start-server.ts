#!/usr/bin/env node

// Load environment variables from .env file
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();

import { serve } from '@hono/node-server';

import app from './index';
import { streamSSE } from 'hono/streaming';
import { Context } from 'hono';
import { createNodeWebSocket } from '@hono/node-ws';
import { realTimeHandlerNode } from './handlers/realtimeHandlerNode';
import { requestValidator } from './middlewares/requestValidator';
import { initializeDatabase, closeDatabase } from './db';
import { cleanupOldRecords } from './services/rateLimitService';

// Extract the port number from the command line arguments
const defaultPort = 8787;
const args = process.argv.slice(2);
const portArg = args.find((arg) => arg.startsWith('--port='));
const port = portArg ? parseInt(portArg.split('=')[1]) : defaultPort;

const isHeadless = args.includes('--headless');

// Setup static file serving only if not in headless mode
if (
  !isHeadless &&
  !(
    process.env.NODE_ENV === 'production' ||
    process.env.ENVIRONMENT === 'production'
  )
) {
  const setupStaticServing = async () => {
    const { join, dirname } = await import('path');
    const { fileURLToPath } = await import('url');
    const { readFileSync, existsSync } = await import('fs');

    const scriptDir = dirname(fileURLToPath(import.meta.url));

    // Serve admin.html for main routes
    const adminPath = join(scriptDir, 'public/admin.html');
    const adminContent = readFileSync(adminPath, 'utf-8');

    const serveAdmin = (c: Context) => {
      return c.html(adminContent);
    };

    // Set up HTML routes
    app.get('/public/', serveAdmin);
    app.get('/public', (c: Context) => {
      return c.redirect('/public/');
    });

    // Root route redirects to admin
    app.get('/', (c: Context) => {
      return c.redirect('/public/');
    });

    // Serve static assets (JS, CSS)
    app.get('/public/js/:filename', (c: Context) => {
      const filename = c.req.param('filename');
      const filePath = join(scriptDir, 'public/js', filename);

      if (!existsSync(filePath)) {
        return c.notFound();
      }

      const content = readFileSync(filePath, 'utf-8');
      return c.text(content, 200, {
        'Content-Type': 'application/javascript',
      });
    });

    app.get('/public/css/:filename', (c: Context) => {
      const filename = c.req.param('filename');
      const filePath = join(scriptDir, 'public/css', filename);

      if (!existsSync(filePath)) {
        return c.notFound();
      }

      const content = readFileSync(filePath, 'utf-8');
      return c.text(content, 200, {
        'Content-Type': 'text/css',
      });
    });

    // Serve template files
    app.get('/public/templates/*', (c: Context) => {
      const templatePath = c.req.path.replace('/public/templates/', '');
      const filePath = join(scriptDir, 'public/templates', templatePath);

      if (!existsSync(filePath)) {
        return c.notFound();
      }

      const content = readFileSync(filePath, 'utf-8');
      return c.text(content, 200, {
        'Content-Type': 'text/html; charset=utf-8',
      });
    });
  };

  // Initialize static file serving
  await setupStaticServing();

  /**
   * A helper function to enforce a timeout on SSE sends.
   * @param fn A function that returns a Promise (e.g. stream.writeSSE())
   * @param timeoutMs The timeout in milliseconds (default: 2000)
   */
  async function sendWithTimeout(fn: () => Promise<void>, timeoutMs = 200) {
    const timeoutPromise = new Promise<void>((_, reject) => {
      const id = setTimeout(() => {
        clearTimeout(id);
        reject(new Error('Write timeout'));
      }, timeoutMs);
    });

    return Promise.race([fn(), timeoutPromise]);
  }

  app.get('/log/stream', (c: Context) => {
    const clientId = Date.now().toString();

    // Set headers to prevent caching
    c.header('Cache-Control', 'no-cache');
    c.header('X-Accel-Buffering', 'no');

    return streamSSE(c, async (stream) => {
      const addLogClient: any = c.get('addLogClient');
      const removeLogClient: any = c.get('removeLogClient');

      const client = {
        sendLog: (message: any) =>
          sendWithTimeout(() => stream.writeSSE(message)),
      };
      // Add this client to the set of log clients
      addLogClient(clientId, client);

      // If the client disconnects (closes the tab, etc.), this signal will be aborted
      const onAbort = () => {
        removeLogClient(clientId);
      };
      c.req.raw.signal.addEventListener('abort', onAbort);

      try {
        // Send an initial connection event
        await sendWithTimeout(() =>
          stream.writeSSE({ event: 'connected', data: clientId })
        );

        // Use an interval instead of a while loop
        const heartbeatInterval = setInterval(async () => {
          if (c.req.raw.signal.aborted) {
            clearInterval(heartbeatInterval);
            return;
          }

          try {
            await sendWithTimeout(() =>
              stream.writeSSE({ event: 'heartbeat', data: 'pulse' })
            );
          } catch (error) {
            // console.error(`Heartbeat failed for client ${clientId}:`, error);
            clearInterval(heartbeatInterval);
            removeLogClient(clientId);
          }
        }, 10000);

        // Wait for abort signal
        await new Promise((resolve) => {
          c.req.raw.signal.addEventListener('abort', () => {
            clearInterval(heartbeatInterval);
            resolve(undefined);
          });
        });
      } catch (error) {
        // console.error(`Error in log stream for client ${clientId}:`, error);
      } finally {
        // Remove this client when the connection is closed
        removeLogClient(clientId);
        c.req.raw.signal.removeEventListener('abort', onAbort);
      }
    });
  });
}

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.get(
  '/v1/realtime',
  requestValidator,
  upgradeWebSocket(realTimeHandlerNode)
);

// Initialize database before starting the server
await initializeDatabase();

// Run initial cleanup
await cleanupOldRecords();

// Schedule periodic cleanup (every hour)
const cleanupInterval = setInterval(
  async () => {
    await cleanupOldRecords();
  },
  60 * 60 * 1000
); // 1 hour

// Handle graceful shutdown
process.on('SIGTERM', () => {
  const timestamp = new Date().toISOString();
  console.log(
    `\n[${timestamp}] [Server] [INFO] SIGTERM received, shutting down gracefully`
  );
  clearInterval(cleanupInterval);
  closeDatabase();
  process.exit(0);
});

process.on('SIGINT', () => {
  const timestamp = new Date().toISOString();
  console.log(
    `\n[${timestamp}] [Server] [INFO] SIGINT received, shutting down gracefully`
  );
  clearInterval(cleanupInterval);
  closeDatabase();
  process.exit(0);
});

const server = serve({
  fetch: app.fetch,
  port: port,
});

const url = `http://localhost:${port}`;

injectWebSocket(server);

// Loading animation function
async function showLoadingAnimation() {
  const frames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
  let i = 0;

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      process.stdout.write(`\r${frames[i]} Starting AI Gateway...`);
      i = (i + 1) % frames.length;
    }, 80);

    // Stop after 1 second
    setTimeout(() => {
      clearInterval(interval);
      process.stdout.write('\r');
      resolve(undefined);
    }, 1000);
  });
}

// Clear the console and show animation before main output
console.clear();
await showLoadingAnimation();

// Main server information with minimal spacing
console.log('\x1b[1m%s\x1b[0m', '🚀 Your AI Gateway is running at:');
console.log('   ' + '\x1b[1;4;32m%s\x1b[0m', `${url}`);

// Secondary information on single lines
if (!isHeadless) {
  console.log(
    '\n\x1b[90m📱 Admin Dashboard:\x1b[0m \x1b[36m%s\x1b[0m',
    `${url}/public/`
  );
}
// console.log('\x1b[90m📚 Docs:\x1b[0m \x1b[36m%s\x1b[0m', 'https://axon.ai/docs');

// Single-line ready message
console.log('\n\x1b[32m✨ Ready for connections!\x1b[0m');

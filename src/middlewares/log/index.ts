import { Context } from 'hono';
import { getRuntimeKey } from 'hono/adapter';
import { getDb } from '../../db';
import { requestActivityLogs } from '../../db/schema';

const LOG_STREAM_ENABLED =
  (process.env.ENABLE_LOG_STREAMS ?? 'true').toLowerCase() !== 'false';

let logId = 0;
const MAX_RESPONSE_LENGTH = 100000;

// Map to store all connected log clients
const logClients: Map<string | number, any> = new Map();

const addLogClient = (clientId: any, client: any) => {
  if (!LOG_STREAM_ENABLED) return;
  logClients.set(clientId, client);
};

const removeLogClient = (clientId: any) => {
  if (!LOG_STREAM_ENABLED) return;
  logClients.delete(clientId);
};

const broadcastLog = async (log: any) => {
  if (!LOG_STREAM_ENABLED) {
    return;
  }
  const message = {
    data: log,
    event: 'log',
    id: String(logId++),
  };

  const deadClients: any = [];

  // Run all sends in parallel
  await Promise.all(
    Array.from(logClients.entries()).map(async ([id, client]) => {
      try {
        await Promise.race([
          client.sendLog(message),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Send timeout')), 1000)
          ),
        ]);
      } catch (error: any) {
        console.error(`Failed to send log to client ${id}:`, error.message);
        deadClients.push(id);
      }
    })
  );

  // Remove dead clients after iteration
  deadClients.forEach((id: any) => {
    removeLogClient(id);
  });
};

function sanitizeForJson(value: any): any {
  try {
    return JSON.parse(
      JSON.stringify(value, (_key, val) => {
        if (val instanceof Response) {
          return {
            status: val.status,
            statusText: val.statusText,
            headers: Object.fromEntries(val.headers.entries()),
          };
        }
        if (val instanceof Request) {
          return {
            url: val.url,
            method: val.method,
            headers: Object.fromEntries(val.headers.entries()),
          };
        }
        if (val instanceof Headers) {
          return Object.fromEntries(val.entries());
        }
        if (val instanceof Date) {
          return val.toISOString();
        }
        if (typeof val === 'bigint') {
          return val.toString();
        }
        if (
          typeof ReadableStream !== 'undefined' &&
          val instanceof ReadableStream
        ) {
          return '[ReadableStream]';
        }
        if (typeof FormData !== 'undefined' && val instanceof FormData) {
          const formEntries: Record<string, any> = {};
          for (const [key, formValue] of val.entries()) {
            if (typeof formValue === 'string') {
              formEntries[key] = formValue;
            } else {
              formEntries[key] = '[Binary]';
            }
          }
          return formEntries;
        }
        if (val && typeof val === 'object') {
          if (ArrayBuffer.isView(val)) {
            return `[${val.constructor.name}]`;
          }
          if (val instanceof ArrayBuffer) {
            return `[ArrayBuffer(${val.byteLength})]`;
          }
        }
        return val;
      })
    );
  } catch (error) {
    console.error('[Logs] Failed to sanitize request options:', error);
    return [];
  }
}

async function saveLogToDatabase(
  c: Context,
  logPayload: {
    method: string;
    endpoint: string;
    status: number;
    duration: number;
    requestOptions: any;
  }
) {
  try {
    const db = getDb();
    const workspace = c.get('workspace');
    const virtualKey = c.get('virtualKey');

    await db.insert(requestActivityLogs).values({
      workspaceId: workspace?.id ?? null,
      virtualKeyId: virtualKey?.id ?? null,
      method: logPayload.method,
      endpoint: logPayload.endpoint,
      statusCode: logPayload.status,
      duration: logPayload.duration,
      requestOptions: logPayload.requestOptions,
    });
  } catch (error: any) {
    console.error('[Logs] Failed to persist request log:', error?.message);
  }
}

async function processLog(c: Context, start: number) {
  const ms = Date.now() - start;
  if (!c.req.url.includes('/v1/')) return;

  const requestOptionsArray = c.get('requestOptions');
  if (!requestOptionsArray?.length) {
    return;
  }

  try {
    const response = requestOptionsArray[0].requestParams.stream
      ? { message: 'The response was a stream.' }
      : await c.res.clone().json();

    const responseString = JSON.stringify(response);
    if (responseString.length > MAX_RESPONSE_LENGTH) {
      requestOptionsArray[0].response =
        responseString.substring(0, MAX_RESPONSE_LENGTH) + '...';
    } else {
      requestOptionsArray[0].response = response;
    }
  } catch (error) {
    console.error('Error processing log:', error);
  }

  let endpoint = c.req.url;
  try {
    endpoint = new URL(c.req.url).pathname;
  } catch {
    endpoint = c.req.url.split('?')[0];
  }

  const sanitizedRequestOptions = sanitizeForJson(requestOptionsArray);

  const persistedLog = {
    time: new Date().toLocaleString(),
    method: c.req.method,
    endpoint,
    status: c.res.status,
    duration: ms,
    requestOptions: sanitizedRequestOptions,
  };

  await saveLogToDatabase(c, {
    method: persistedLog.method,
    endpoint: persistedLog.endpoint,
    status: persistedLog.status,
    duration: persistedLog.duration,
    requestOptions: sanitizedRequestOptions,
  });

  await broadcastLog(JSON.stringify(persistedLog));
}

export const logger = () => {
  return async (c: Context, next: any) => {
    c.set('addLogClient', addLogClient);
    c.set('removeLogClient', removeLogClient);

    const start = Date.now();

    await next();

    const runtime = getRuntimeKey();

    if (runtime == 'workerd') {
      c.executionCtx.waitUntil(processLog(c, start));
    } else if (['node', 'bun', 'deno'].includes(runtime)) {
      processLog(c, start).then().catch(console.error);
    }
  };
};

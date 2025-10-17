import { Context } from 'hono';
import { and, count, desc, eq, like, lt, gte, or } from 'drizzle-orm';
import { getDb } from '../../db';
import { requestActivityLogs } from '../../db/schema';

const LOG_STREAM_ENABLED =
  (process.env.ENABLE_LOG_STREAMS ?? 'true').toLowerCase() !== 'false';
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

type ListLogsQuery = {
  page?: string | null;
  pageSize?: string | null;
  search?: string | null;
  status?: string | null;
};

function parseNumber(value: string | null | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function buildStatusFilter(status?: string | null) {
  if (!status || !/^[1-5]xx$/.test(status)) {
    return null;
  }

  const prefix = Number(status[0]) * 100;
  return and(
    gte(requestActivityLogs.statusCode, prefix),
    lt(requestActivityLogs.statusCode, prefix + 100)
  );
}

function formatLogEntry(log: (typeof requestActivityLogs)['$inferSelect']) {
  const createdAt =
    log.createdAt instanceof Date
      ? log.createdAt.toISOString()
      : new Date(log.createdAt).toISOString();

  return {
    id: log.id,
    method: log.method,
    endpoint: log.endpoint,
    status: log.statusCode,
    duration: log.duration ?? 0,
    createdAt,
    requestOptions: log.requestOptions ?? [],
    workspaceId: log.workspaceId,
    virtualKeyId: log.virtualKeyId,
  };
}

export async function listLogs(c: Context) {
  const workspace = c.get('workspace');
  if (!workspace) {
    return c.json({ message: 'Workspace context not found' }, 400);
  }

  const query = c.req.query() as ListLogsQuery;
  const page = parseNumber(query.page, 1);
  const rawPageSize = parseNumber(query.pageSize, DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(Math.max(rawPageSize, 1), MAX_PAGE_SIZE);
  const offset = (page - 1) * pageSize;
  const search = query.search?.trim();

  let whereClause = eq(requestActivityLogs.workspaceId, workspace.id);

  const statusFilter = buildStatusFilter(query.status);
  if (statusFilter) {
    whereClause = and(whereClause, statusFilter);
  }

  if (search) {
    const pattern = `%${search}%`;
    const searchFilter = or(
      like(requestActivityLogs.endpoint, pattern),
      like(requestActivityLogs.method, pattern)
    );
    whereClause = and(whereClause, searchFilter);
  }

  const db = getDb();

  const [logs, totalResult] = await Promise.all([
    db
      .select()
      .from(requestActivityLogs)
      .where(whereClause)
      .orderBy(desc(requestActivityLogs.createdAt))
      .limit(pageSize)
      .offset(offset),
    db.select({ total: count() }).from(requestActivityLogs).where(whereClause),
  ]);

  const total = Number(totalResult[0]?.total ?? 0);

  return c.json({
    data: logs.map(formatLogEntry),
    pagination: {
      page,
      pageSize,
      total,
    },
    streamEnabled: LOG_STREAM_ENABLED,
  });
}

export async function getLog(c: Context) {
  const workspace = c.get('workspace');
  if (!workspace) {
    return c.json({ message: 'Workspace context not found' }, 400);
  }

  const { id } = c.req.param();
  if (!id) {
    return c.json({ message: 'Log not found' }, 404);
  }

  const db = getDb();
  const [log] = await db
    .select()
    .from(requestActivityLogs)
    .where(
      and(
        eq(requestActivityLogs.id, id),
        eq(requestActivityLogs.workspaceId, workspace.id)
      )
    )
    .limit(1);

  if (!log) {
    return c.json({ message: 'Log not found' }, 404);
  }

  return c.json({
    data: formatLogEntry(log),
    streamEnabled: LOG_STREAM_ENABLED,
  });
}

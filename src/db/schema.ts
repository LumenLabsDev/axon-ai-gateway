import { sqliteTable, text, integer, real, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * Workspaces table
 * Represents an organization or team workspace
 */
export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull(),
  description: text('description'),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});

/**
 * Users table
 * Users belonging to workspaces with roles
 */
export const users = sqliteTable('users', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  name: text('name').notNull(),
  role: text('role', { enum: ['admin', 'editor', 'viewer'] }).notNull().default('viewer'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  emailIdx: index('users_email_idx').on(table.email),
  workspaceIdx: index('users_workspace_idx').on(table.workspaceId),
}));

/**
 * Provider Keys table
 * Stores encrypted API keys for AI providers (OpenAI, Anthropic, Gemini, etc.)
 */
export const providerKeys = sqliteTable('provider_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  provider: text('provider').notNull(), // openai, anthropic, gemini, etc.
  encryptedKey: text('encrypted_key').notNull(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceProviderIdx: index('provider_keys_workspace_provider_idx').on(table.workspaceId, table.provider),
}));

/**
 * API Keys table
 * Custom API keys for gateway access with rate limits and permissions
 */
export const apiKeys = sqliteTable('api_keys', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  permissions: text('permissions', { mode: 'json' }).$type<Record<string, boolean>>().notNull(),
  rateLimitRpm: integer('rate_limit_rpm'), // requests per minute
  rateLimitTpm: integer('rate_limit_tpm'), // tokens per minute
  allowedModels: text('allowed_models', { mode: 'json' }).$type<string[]>(),
  metadata: text('metadata', { mode: 'json' }).$type<Record<string, any>>(),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  expiresAt: integer('expires_at', { mode: 'timestamp' }),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
}, (table) => ({
  keyHashIdx: index('api_keys_key_hash_idx').on(table.keyHash),
  workspaceIdx: index('api_keys_workspace_idx').on(table.workspaceId),
}));

/**
 * Prompts table
 * Stores prompt templates
 */
export const prompts = sqliteTable('prompts', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  folder: text('folder'),
  description: text('description'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceIdx: index('prompts_workspace_idx').on(table.workspaceId),
  nameIdx: index('prompts_name_idx').on(table.name),
}));

/**
 * Prompt Versions table
 * Stores versioned prompt templates with status
 */
export const promptVersions = sqliteTable('prompt_versions', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  promptId: text('prompt_id').notNull().references(() => prompts.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  template: text('template').notNull(), // JSON or text template
  variables: text('variables', { mode: 'json' }).$type<Record<string, any>>(),
  params: text('params', { mode: 'json' }).$type<Record<string, any>>(), // model, temperature, etc.
  status: text('status', { enum: ['draft', 'development', 'staging', 'production'] }).notNull().default('draft'),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  promptIdx: index('prompt_versions_prompt_idx').on(table.promptId),
  statusIdx: index('prompt_versions_status_idx').on(table.status),
}));

/**
 * Prompt Partials table
 * Reusable prompt fragments
 */
export const promptPartials = sqliteTable('prompt_partials', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  template: text('template').notNull(),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceIdx: index('prompt_partials_workspace_idx').on(table.workspaceId),
  nameIdx: index('prompt_partials_name_idx').on(table.name),
}));

/**
 * Guardrails table
 * Stores guardrail configurations with checks and actions
 */
export const guardrails = sqliteTable('guardrails', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  checks: text('checks', { mode: 'json' }).$type<Array<{
    id: string;
    parameters: Record<string, any>;
    enabled?: boolean;
    timeout?: number;
    inverse?: boolean;
  }>>().notNull(),
  actions: text('actions', { mode: 'json' }).$type<{
    onSuccess?: {
      addFeedback?: {
        value: number;
        weight: number;
        metadata?: Record<string, any>;
      };
    };
    onFailure?: {
      addFeedback?: {
        value: number;
        weight: number;
        metadata?: Record<string, any>;
      };
      denyRequest?: boolean;
    };
  }>(),
  async: integer('async', { mode: 'boolean' }).notNull().default(false),
  createdBy: text('created_by').references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceIdx: index('guardrails_workspace_idx').on(table.workspaceId),
}));

/**
 * Rate Limit Usage table
 * Tracks API usage for rate limiting
 */
export const rateLimitUsage = sqliteTable('rate_limit_usage', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  apiKeyId: text('api_key_id').notNull().references(() => apiKeys.id, { onDelete: 'cascade' }),
  windowStart: integer('window_start', { mode: 'timestamp' }).notNull(),
  requestsCount: integer('requests_count').notNull().default(0),
  tokensCount: integer('tokens_count').notNull().default(0),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  apiKeyWindowIdx: index('rate_limit_usage_api_key_window_idx').on(table.apiKeyId, table.windowStart),
}));

/**
 * Workspace Guardrails binding table
 * Links guardrails to workspaces or specific API keys
 */
export const workspaceGuardrails = sqliteTable('workspace_guardrails', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  guardrailId: text('guardrail_id').notNull().references(() => guardrails.id, { onDelete: 'cascade' }),
  apiKeyId: text('api_key_id').references(() => apiKeys.id, { onDelete: 'cascade' }), // optional: bind to specific key
  mode: text('mode', { enum: ['block', 'observe'] }).notNull().default('observe'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (table) => ({
  workspaceIdx: index('workspace_guardrails_workspace_idx').on(table.workspaceId),
  guardrailIdx: index('workspace_guardrails_guardrail_idx').on(table.guardrailId),
}));

// Type exports for use in application code
export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ProviderKey = typeof providerKeys.$inferSelect;
export type NewProviderKey = typeof providerKeys.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Prompt = typeof prompts.$inferSelect;
export type NewPrompt = typeof prompts.$inferInsert;

export type PromptVersion = typeof promptVersions.$inferSelect;
export type NewPromptVersion = typeof promptVersions.$inferInsert;

export type PromptPartial = typeof promptPartials.$inferSelect;
export type NewPromptPartial = typeof promptPartials.$inferInsert;

export type Guardrail = typeof guardrails.$inferSelect;
export type NewGuardrail = typeof guardrails.$inferInsert;

export type RateLimitUsage = typeof rateLimitUsage.$inferSelect;
export type NewRateLimitUsage = typeof rateLimitUsage.$inferInsert;

export type WorkspaceGuardrail = typeof workspaceGuardrails.$inferSelect;
export type NewWorkspaceGuardrail = typeof workspaceGuardrails.$inferInsert;


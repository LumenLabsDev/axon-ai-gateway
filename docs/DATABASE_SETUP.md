# Database Backend Setup Guide

This guide explains how to use the database-backed features of Axon AI Gateway, including workspaces, admin keys, virtual keys, provider keys, prompts, and guardrails.

## Overview

Axon AI Gateway uses SQLite with Drizzle ORM to provide:

- **Multi-workspace** architecture for team/project isolation
- **Two-tier authentication**: Admin keys for management, Virtual keys for API access
- **Encrypted storage** of provider API keys using AES-256-GCM
- **Rate limiting** with requests-per-minute (RPM) and tokens-per-minute (TPM)
- **Model restrictions** per virtual key
- **Prompt templates** with versioning
- **Guardrails** for input/output validation
- **Analytics** and usage tracking

## Key Concepts

The gateway uses two types of keys:

### Admin Keys (`ak_*`)
- **Purpose**: Authenticate to the admin panel
- **Header**: `x-axon-admin-key`
- **Features**: Global access, no rate limits, manage all resources
- **Used for**: Admin panel, managing workspaces, users, and settings

### Virtual Keys (`vk_*`)
- **Purpose**: Gateway API access with cost controls
- **Header**: `x-axon-api-key`
- **Features**: Rate limits (RPM/TPM), model restrictions, workspace-scoped
- **Used for**: Making AI requests through the gateway

## Prerequisites

1. Set the `ENCRYPTION_KEY` environment variable for encrypting provider API keys:
```bash
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")
```

2. (Optional) Set custom database path:
```bash
export DATABASE_PATH="./data/gateway.db"  # Default path
```

## Quick Start

### 1. Bootstrap Your Gateway

Run the bootstrap script to create initial workspace and keys:

```bash
npx tsx scripts/bootstrap.ts
```

This creates:
- Default workspace
- Admin user
- **Admin key** for admin panel access
- **Virtual key** for gateway requests

**Important:** Save both keys from the output - they won't be shown again!

### 2. Start the Server

```bash
npm run dev:node
```

The server will:
- Initialize database if needed
- Apply schema migrations
- Start periodic cleanup jobs
- Be ready at `http://localhost:8787`

## Getting Started (Manual Setup)

If you prefer manual setup instead of bootstrap:

**Manual Setup Script:**

```javascript
// manual-setup.js
import { initializeDatabase, getDb } from './src/db/index.ts';
import { workspaces, users, adminKeys, virtualKeys } from './src/db/schema.ts';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';

await initializeDatabase();
const db = getDb();

// Create workspace
const workspace = await db.insert(workspaces).values({
  name: 'My Workspace',
  description: 'Main workspace',
}).returning().get();

// Create admin user
const user = await db.insert(users).values({
  workspaceId: workspace.id,
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'admin',
}).returning().get();

// Generate Admin Key (for admin panel)
const adminKeyPlain = `ak_${randomBytes(32).toString('base64url')}`;
const adminKeyHash = hashSync(adminKeyPlain, 10);

const adminKey = await db.insert(adminKeys).values({
  keyHash: adminKeyHash,
  name: 'Admin Panel Key',
  description: 'For accessing admin panel',
}).returning().get();

// Generate Virtual Key (for gateway API)
const virtualKeyPlain = `vk_${randomBytes(32).toString('base64url')}`;
const virtualKeyHash = hashSync(virtualKeyPlain, 10);

const virtualKey = await db.insert(virtualKeys).values({
  workspaceId: workspace.id,
  keyHash: virtualKeyHash,
  name: 'Main Virtual Key',
  description: 'For gateway requests',
  rateLimitRpm: null, // No limit
  rateLimitTpm: null,
  createdBy: user.id,
}).returning().get();

console.log('Workspace ID:', workspace.id);
console.log('Admin Key (for panel):', adminKeyPlain);
console.log('Virtual Key (for API):', virtualKeyPlain);
console.log('\nIMPORTANT: SAVE THESE KEYS - THEY WILL NOT BE SHOWN AGAIN!');
```

Run with: `tsx manual-setup.js`

### 2. Add Provider Keys

Store encrypted provider API keys (OpenAI, Anthropic, Gemini, etc.) using your **admin key**:

```bash
curl -X POST http://localhost:8787/v1/admin/provider-keys \
  -H "x-axon-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openai-main",
    "provider": "openai",
    "apiKey": "sk-...",
    "workspaceId": "YOUR_WORKSPACE_ID"
  }'
```

### 3. Create Virtual Keys with Rate Limits

Create virtual keys with cost controls using your **admin key**:

```bash
curl -X POST http://localhost:8787/v1/admin/virtual-keys \
  -H "x-axon-admin-key: YOUR_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "description": "For production use",
    "workspaceId": "YOUR_WORKSPACE_ID",
    "rateLimitRpm": 100,
    "rateLimitTpm": 50000,
    "allowedModels": ["gpt-4", "gpt-3.5-turbo"]
  }'
```

**Response includes the plain key (save it!):**
```json
{
  "status": "success",
  "data": {
    "id": "...",
    "plainKey": "vk_...",
    "name": "Production Key",
    ...
  },
  "message": "Virtual key created. Save the plainKey now - it will not be shown again."
}
```

### 4. Use Virtual Keys for Gateway Requests

Make AI requests using your **virtual key**:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "x-axon-api-key: YOUR_VIRTUAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### 5. Create Prompt Templates

Create reusable prompt templates with variables:

```bash
curl -X POST http://localhost:8787/v1/admin/prompts \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "customer-support",
    "description": "Customer support prompt",
    "template": "[{\"role\":\"system\",\"content\":\"You are a helpful customer support agent.\"},{\"role\":\"user\",\"content\":\"{{user_question}}\"}]",
    "variables": {
      "user_question": ""
    },
    "params": {
      "model": "gpt-4",
      "temperature": 0.7
    },
    "status": "production"
  }'
```

**Use the prompt:**
```bash
curl -X POST http://localhost:8787/v1/prompts/PROMPT_ID/v1/chat/completions \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "x-axon-provider: openai" \
  -H "x-axon-virtual-key: openai-main" \
  -H "Content-Type: application/json" \
  -d '{
    "variables": {
      "user_question": "How do I reset my password?"
    }
  }'
```

### 6. Create Guardrails

Create guardrails with multiple checks and actions:

```bash
curl -X POST http://localhost:8787/v1/admin/guardrails \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "content-safety",
    "description": "Basic content safety checks",
    "checks": [
      {
        "id": "default.regex",
        "parameters": {
          "pattern": "badword1|badword2",
          "match": false
        }
      },
      {
        "id": "default.containsPII",
        "parameters": {
          "entities": ["EMAIL", "PHONE"]
        }
      }
    ],
    "actions": {
      "onFailure": {
        "denyRequest": true,
        "addFeedback": {
          "value": -10,
          "weight": 1,
          "metadata": {"reason": "safety_violation"}
        }
      }
    },
    "async": false
  }'
```

**Bind guardrail to workspace:**
```bash
curl -X POST http://localhost:8787/v1/admin/guardrails/GUARDRAIL_ID/bind \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "block"
  }'
```

Or bind to specific API key:
```bash
curl -X POST http://localhost:8787/v1/admin/guardrails/GUARDRAIL_ID/bind \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "apiKeyId": "API_KEY_ID",
    "mode": "observe"
  }'
```

## API Endpoints

**Note:** All admin endpoints require `x-axon-admin-key` header. Gateway endpoints require `x-axon-api-key` header.

### Admin Keys (Panel Access)
- `GET /v1/admin/admin-keys` - List admin keys
- `POST /v1/admin/admin-keys` - Create admin key
- `GET /v1/admin/admin-keys/:id` - Get admin key details
- `PATCH /v1/admin/admin-keys/:id` - Update admin key
- `DELETE /v1/admin/admin-keys/:id` - Revoke admin key

### Virtual Keys (Gateway Access with Rate Limits)
- `GET /v1/admin/virtual-keys` - List virtual keys with usage stats
- `POST /v1/admin/virtual-keys` - Create virtual key (returns plain key once)
- `GET /v1/admin/virtual-keys/:id` - Get virtual key details with usage
- `PATCH /v1/admin/virtual-keys/:id` - Update limits/models
- `DELETE /v1/admin/virtual-keys/:id` - Revoke virtual key

### Workspaces
- `GET /v1/admin/workspaces` - List all workspaces
- `POST /v1/admin/workspaces` - Create workspace
- `GET /v1/admin/workspaces/:id` - Get workspace details
- `PATCH /v1/admin/workspaces/:id` - Update workspace

### Users
- `GET /v1/admin/users?workspaceId=xxx` - List workspace users
- `POST /v1/admin/users` - Create user
- `GET /v1/admin/users/:id` - Get user details
- `PATCH /v1/admin/users/:id` - Update user role
- `DELETE /v1/admin/users/:id` - Delete user

### Provider Keys
- `GET /v1/admin/provider-keys?workspaceId=xxx` - List provider keys (masked)
- `POST /v1/admin/provider-keys` - Create provider key
- `GET /v1/admin/provider-keys/:id` - Get provider key details
- `PATCH /v1/admin/provider-keys/:id` - Update provider key
- `DELETE /v1/admin/provider-keys/:id` - Delete provider key

### Prompts
- `GET /v1/admin/prompts` - List prompts
- `POST /v1/admin/prompts` - Create prompt with initial version
- `GET /v1/admin/prompts/:id` - Get prompt with all versions
- `GET /v1/admin/prompts/:id/versions/:version` - Get specific version
- `POST /v1/admin/prompts/:id/versions` - Create new version
- `PATCH /v1/admin/prompts/:id/versions/:version` - Update/publish version
- `DELETE /v1/admin/prompts/:id` - Delete prompt

### Prompt Partials
- `GET /v1/admin/prompt-partials` - List partials
- `POST /v1/admin/prompt-partials` - Create partial
- `GET /v1/admin/prompt-partials/:id` - Get partial
- `PATCH /v1/admin/prompt-partials/:id` - Update partial
- `DELETE /v1/admin/prompt-partials/:id` - Delete partial

### Guardrails
- `GET /v1/admin/guardrails` - List guardrails
- `POST /v1/admin/guardrails` - Create guardrail
- `GET /v1/admin/guardrails/:id` - Get guardrail details
- `PATCH /v1/admin/guardrails/:id` - Update guardrail
- `DELETE /v1/admin/guardrails/:id` - Delete guardrail
- `POST /v1/admin/guardrails/:id/bind` - Bind to workspace/API key
- `DELETE /v1/admin/guardrails/:id/bind/:bindingId` - Unbind

## Rate Limiting

Virtual keys support two types of rate limits:

1. **Requests Per Minute (RPM)**: Maximum number of requests in a 1-minute window
2. **Tokens Per Minute (TPM)**: Maximum number of tokens in a 1-minute window

Example:
```json
{
  "rateLimitRpm": 100,
  "rateLimitTpm": 50000
}
```

Set to `null` for no limit.

## Database Management

### View Database
```bash
npm run db:studio
```

Opens Drizzle Studio at `https://local.drizzle.studio`

### Migrations
```bash
# Generate new migration
npm run db:generate

# Apply migrations
npm run db:migrate

# Push schema directly (development)
npm run db:push
```

### Backup
```bash
# SQLite backup
cp ./data/gateway.db ./data/gateway.db.backup
```

## Environment Variables

```bash
# Required
ENCRYPTION_KEY=your-secret-key-for-encrypting-provider-keys

# Optional
DATABASE_PATH=./data/gateway.db  # Default path
```

## Security Best Practices

1. **Keep ENCRYPTION_KEY secure** - Store in environment variables, never commit to git
2. **Separate key types** - Use admin keys only for admin panel, virtual keys for gateway
3. **Rotate keys regularly** - Create new keys and revoke old ones
4. **Set appropriate rate limits** - Prevent abuse and manage costs on virtual keys
5. **Monitor usage** - Check virtual key usage stats regularly
6. **Backup database** - Regular backups of gateway.db file
7. **Use guardrails** - Protect against malicious inputs and outputs
8. **Restrict admin keys** - Only create admin keys for trusted administrators

## Troubleshooting

### Authentication failed
- **Admin panel**: Make sure you're using `x-axon-admin-key` header with admin key (`ak_*`)
- **Gateway API**: Make sure you're using `x-axon-api-key` header with virtual key (`vk_*`)
- Check that the key is active and not expired

### Database locked error
SQLite can have lock issues with concurrent writes. The gateway uses WAL mode to minimize this.

### Rate limit not working
- Check that `rateLimitRpm` and `rateLimitTpm` are set on the **virtual key**
- Admin keys don't have rate limits
- Usage is tracked in 1-minute windows

### Provider key decryption fails
Ensure `ENCRYPTION_KEY` environment variable is set and matches the key used when creating the provider key.

### Guardrails not executing
- Check that the guardrail is bound to the workspace or virtual key
- Verify the check IDs are valid (e.g., `default.regex`)
- Check mode is set to `block` if you want to deny requests

## Example Workflow

1. **Bootstrap**: Run `npx tsx scripts/bootstrap.ts` to create workspace, admin key, and virtual key
2. **Configure Providers**: Add OpenAI, Anthropic, Gemini keys using admin key
3. **Create Virtual Keys**: Generate keys for different environments (dev, staging, prod) with rate limits
4. **Build Prompts**: Create versioned prompt templates using admin panel
5. **Add Safety**: Create and bind guardrails for content safety
6. **Deploy**: Use virtual keys in your applications for gateway access
7. **Monitor**: Check usage stats and rate limits via admin panel or API

## Support

For issues or questions, check the main README.md or open an issue on GitHub.


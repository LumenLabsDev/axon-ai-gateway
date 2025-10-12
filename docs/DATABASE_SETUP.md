# Database Backend Setup Guide

This guide explains how to use the database-backed features of the AI Gateway, including workspaces, API keys, provider keys, prompts, and guardrails.

## Prerequisites

1. Set the `ENCRYPTION_KEY` environment variable for encrypting provider API keys:
```bash
export ENCRYPTION_KEY="your-secure-encryption-key-here"
```

2. (Optional) Set custom database path:
```bash
export DATABASE_PATH="./data/gateway.db"  # Default path
```

## Database Initialization

The database is automatically initialized when you start the server:

```bash
npm run dev:node
```

The server will:
- Create the database file if it doesn't exist
- Apply the schema
- Start periodic cleanup jobs (runs every hour)

## Getting Started

### 1. Create a Workspace

First, you need to create a workspace. For the initial setup, you'll need to bootstrap by creating a workspace and initial API key directly in the database or through a one-time setup script.

**Bootstrap Script Example:**

```javascript
// bootstrap.js
import { initializeDatabase, getDb } from './src/db/index.ts';
import { workspaces, users, apiKeys } from './src/db/schema.ts';
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

// Generate API key
const plainKey = `pk_${randomBytes(32).toString('base64url')}`;
const keyHash = hashSync(plainKey, 10);

const apiKey = await db.insert(apiKeys).values({
  workspaceId: workspace.id,
  keyHash,
  name: 'Admin Key',
  permissions: {
    'workspaces.read': true,
    'workspaces.write': true,
    'users.read': true,
    'users.write': true,
    'provider_keys.read': true,
    'provider_keys.write': true,
    'api_keys.read': true,
    'api_keys.write': true,
    'prompts.read': true,
    'prompts.write': true,
    'guardrails.read': true,
    'guardrails.write': true,
  },
  rateLimitRpm: null, // No rate limit
  rateLimitTpm: null,
  createdBy: user.id,
}).returning().get();

console.log('Workspace created:', workspace.id);
console.log('User created:', user.id);
console.log('API Key:', plainKey);
console.log('SAVE THIS KEY - IT WILL NOT BE SHOWN AGAIN!');
```

Run with: `tsx bootstrap.js`

### 2. Add Provider Keys

Store encrypted provider API keys (OpenAI, Anthropic, Gemini, etc.):

```bash
curl -X POST http://localhost:8787/v1/admin/provider-keys \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "openai-main",
    "provider": "openai",
    "apiKey": "sk-..."
  }'
```

### 3. Create Custom API Keys

Create API keys with specific permissions and rate limits:

```bash
curl -X POST http://localhost:8787/v1/admin/api-keys \
  -H "x-axon-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production Key",
    "description": "For production use",
    "permissions": {
      "completions.create": true,
      "prompts.read": true
    },
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
    "plainKey": "pk_...",
    "name": "Production Key",
    ...
  },
  "message": "API key created. Save the plainKey now - it will not be shown again."
}
```

### 4. Create Prompt Templates

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

### 5. Create Guardrails

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

### Workspaces
- `GET /v1/admin/workspaces` - List all workspaces
- `POST /v1/admin/workspaces` - Create workspace
- `GET /v1/admin/workspaces/:id` - Get workspace details
- `PATCH /v1/admin/workspaces/:id` - Update workspace

### Users
- `GET /v1/admin/users` - List workspace users
- `POST /v1/admin/users` - Create user
- `GET /v1/admin/users/:id` - Get user details
- `PATCH /v1/admin/users/:id` - Update user role
- `DELETE /v1/admin/users/:id` - Delete user

### Provider Keys
- `GET /v1/admin/provider-keys` - List provider keys (masked)
- `POST /v1/admin/provider-keys` - Create provider key
- `GET /v1/admin/provider-keys/:id` - Get provider key details
- `PATCH /v1/admin/provider-keys/:id` - Update provider key
- `DELETE /v1/admin/provider-keys/:id` - Delete provider key

### API Keys
- `GET /v1/admin/api-keys` - List API keys with usage stats
- `POST /v1/admin/api-keys` - Create API key (returns plain key once)
- `GET /v1/admin/api-keys/:id` - Get API key details with usage
- `PATCH /v1/admin/api-keys/:id` - Update limits/permissions
- `DELETE /v1/admin/api-keys/:id` - Revoke API key

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

## Permissions

Available permissions for API keys:

```json
{
  "workspaces.read": true,
  "workspaces.write": true,
  "users.read": true,
  "users.write": true,
  "provider_keys.read": true,
  "provider_keys.write": true,
  "api_keys.read": true,
  "api_keys.write": true,
  "prompts.read": true,
  "prompts.write": true,
  "guardrails.read": true,
  "guardrails.write": true,
  "completions.create": true
}
```

## Rate Limiting

API keys support two types of rate limits:

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
2. **Rotate API keys regularly** - Create new keys and delete old ones
3. **Use least privilege** - Only grant necessary permissions to API keys
4. **Set appropriate rate limits** - Prevent abuse and manage costs
5. **Monitor usage** - Check API key usage stats regularly
6. **Backup database** - Regular backups of gateway.db file
7. **Use guardrails** - Protect against malicious inputs and outputs

## Troubleshooting

### Database locked error
SQLite can have lock issues with concurrent writes. The gateway uses WAL mode to minimize this.

### Rate limit not working
Check that `rateLimitRpm` and `rateLimitTpm` are set on the API key. Usage is tracked in 1-minute windows.

### Provider key decryption fails
Ensure `ENCRYPTION_KEY` environment variable is set and matches the key used when creating the provider key.

### Guardrails not executing
- Check that the guardrail is bound to the workspace or API key
- Verify the check IDs are valid (e.g., `default.regex`)
- Check mode is set to `block` if you want to deny requests

## Example Workflow

1. **Setup**: Create workspace, admin user, and bootstrap API key
2. **Configure Providers**: Add OpenAI, Anthropic, Gemini keys
3. **Create API Keys**: Generate keys for different environments (dev, staging, prod) with appropriate limits
4. **Build Prompts**: Create versioned prompt templates
5. **Add Safety**: Create and bind guardrails for content safety
6. **Deploy**: Use custom API keys in your applications
7. **Monitor**: Check usage stats and rate limits via admin API

## Support

For issues or questions, check the main README.md or open an issue on GitHub.


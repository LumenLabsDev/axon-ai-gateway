# Getting Started with Axon AI Gateway

Welcome to Axon AI Gateway! This guide will help you set up and start using the gateway in minutes.

## What is Axon AI Gateway?

Axon AI Gateway is a unified API gateway for accessing multiple AI providers (OpenAI, Anthropic, Google Gemini, and more) through a single interface. It provides:

- **Unified API**: One API for 100+ LLM providers
- **Rate Limiting**: Control costs with RPM/TPM limits
- **Model Restrictions**: Limit which models can be accessed
- **Encryption**: Secure storage of provider API keys
- **Workspaces**: Organize resources by team or project
- **Admin Dashboard**: Beautiful UI for managing everything

## Quick Start (5 minutes)

### 1. Prerequisites

Make sure you have installed:
- Node.js 18+ or Bun
- A provider API key (OpenAI, Anthropic, etc.)

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
# or
bun install
```

### 3. Set Up Environment

Create a `.env` file:

```bash
# Generate a secure encryption key
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))" > .env
echo "DATABASE_PATH=./data/gateway.db" >> .env
# Optional: disable real-time log streaming if you don't need the /log/stream endpoint
# echo "ENABLE_LOG_STREAMS=false" >> .env
```

### 4. Initialize Database & Create Admin Key

```bash
npx tsx scripts/bootstrap.ts
```

**IMPORTANT:** Save the admin key that's displayed! You'll need it to access the admin panel.

Example output:
```
Bootstrap completed successfully!

YOUR ADMIN KEY (for admin panel - SAVE THIS):
   ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

Next steps:
   1. Start the server: npm run dev:node
   2. Open http://localhost:8787/public/
   3. Enter your admin key
   4. Add provider keys (OpenAI, Anthropic, etc.)
   5. Create virtual keys for your apps
```

### 5. Start the Server

```bash
npm run dev:node
```

The server will start on `http://localhost:8787`

### 6. Access the Admin Panel

1. Open your browser to `http://localhost:8787/public/`
2. Enter your admin key (starts with `ak_`)
3. Click "Save & Continue"

### 7. Add a Provider Key

Before using the gateway, add at least one AI provider:

1. Navigate to **"Provider Keys"** in the sidebar
2. Click **"Create Provider Key"**
3. Fill in:
   - **Name**: e.g., "My OpenAI Key"
   - **Provider**: openai, anthropic, gemini, etc.
   - **API Key**: Your actual provider API key (e.g., `sk-...`)
4. Click **"Create"**

The key is encrypted and stored securely in the database.

### 8. Create a Virtual Key

Virtual keys are what your applications use:

1. Navigate to **"Virtual Keys"** in the sidebar
2. Click **"Create Virtual Key"**
3. Fill in:
   - **Name**: e.g., "Production App"
   - **Provider Key**: Select the provider key you just created
   - **Rate Limits** (optional):
     - RPM: Requests per minute (e.g., 100)
     - TPM: Tokens per minute (e.g., 50000)
   - **Allowed Models** (optional): e.g., `gpt-4o`, `gpt-4o-mini`
4. Click **"Create"**
5. **IMPORTANT:** Save the key - it's only shown once!

### 9. Use the Gateway

Test your virtual key:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VIRTUAL_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [
      {"role": "user", "content": "Hello! What can you help me with?"}
    ]
  }'
```

Or use the **Playground** in the admin panel to test interactively!

## Architecture Overview

```
┌─────────────────┐
│  Your App       │
│  (uses vk_*)    │
└────────┬────────┘
         │ Virtual Key
         ↓
┌─────────────────┐
│  Axon Gateway   │
│  - Auth         │
│  - Rate Limit   │
│  - Model Check  │
└────────┬────────┘
         │ Provider Key (encrypted)
         ↓
┌─────────────────┐
│  AI Provider    │
│  (OpenAI, etc.) │
└─────────────────┘
```

## Key Concepts

### Admin Keys (`ak_*`)
- Access the admin panel
- Manage all resources (workspaces, users, keys)
- No rate limits
- Full control

### Virtual Keys (`vk_*`)
- Access the gateway API
- Linked to a specific provider key
- Optional rate limits (RPM/TPM)
- Optional model restrictions
- Used in your applications

### Provider Keys
- Store encrypted AI provider API keys
- Link to providers (OpenAI, Anthropic, etc.)
- One provider key → many virtual keys
- Never exposed to clients

### Workspaces
- Organize resources by team/project
- Isolate keys, prompts, and usage
- Multi-tenant support

## Common Workflows

### Development Setup
```bash
# 1. Bootstrap
npx tsx scripts/bootstrap.ts

# 2. Add OpenAI key
# (via admin panel)

# 3. Create dev virtual key
# (via admin panel, no rate limits)

# 4. Use in your app
export AXON_API_KEY="vk_..."
npm run dev
```

### Production Setup
```bash
# 1. Create production workspace
# 2. Add provider keys for production
# 3. Create virtual keys with rate limits:
#    - RPM: 1000
#    - TPM: 100000
#    - Models: ["gpt-4o", "gpt-4o-mini"]
# 4. Use in production apps
# 5. Monitor usage in admin panel
```

## Troubleshooting

### "Invalid admin key" Error

**Problem**: The admin key isn't recognized.

**Solution**:
1. Make sure you copied the complete key (starts with `ak_`)
2. Check for extra spaces
3. Try a hard refresh (Ctrl+F5)
4. If lost, run `npx tsx scripts/bootstrap.ts` again (creates a new workspace)

### "ENCRYPTION_KEY not set" Error

**Problem**: Environment variable missing.

**Solution**:
```bash
node -e "console.log('ENCRYPTION_KEY=' + require('crypto').randomBytes(32).toString('base64'))" >> .env
```

### "Workspace context required" Error

**Problem**: Frontend can't load workspace.

**Solution**:
1. Hard refresh browser (Ctrl+F5)
2. Clear localStorage: DevTools → Application → Local Storage → Clear
3. Re-enter admin key

### Virtual Key Doesn't Work

**Problem**: 401 or 403 errors when using virtual key.

**Solutions**:
- **401**: Invalid virtual key - check you copied it correctly
- **403**: Model not allowed - check Allowed Models in the virtual key settings
- **429**: Rate limit exceeded - wait or increase limits

### Server Won't Start

**Problem**: Server crashes or won't start.

**Solution**:
1. Check environment variables (`.env` file)
2. Ensure `data/` directory exists: `mkdir -p data`
3. Check port 8787 isn't in use: `lsof -i :8787` (Unix) or `netstat -ano | findstr :8787` (Windows)
4. Check logs for specific errors

## Next Steps

- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)**: Complete API documentation
- **[LOGIN_INSTRUCTIONS.md](./LOGIN_INSTRUCTIONS.md)**: Detailed login guide
- **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)**: Environment configuration
- **Explore the Admin Panel**: Prompts, Guardrails, Analytics
- **Check the Playground**: Test requests interactively
- **Monitor Usage**: View analytics and request logs

## Getting Help

- Check the docs in `docs/` folder
- Open an issue on GitHub for bugs
- Request features via GitHub issues
- Check server logs for error details

---

**Ready to build?** Start with the admin panel at `http://localhost:8787/public/`


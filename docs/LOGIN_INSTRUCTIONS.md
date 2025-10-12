# Admin Panel Login Guide

Welcome to the Axon AI Gateway! This guide will help you log in to the admin panel.

## First Time Setup

### 1. Generate Your Admin Key

Run the bootstrap script to create your admin key:

```bash
npx tsx scripts/bootstrap.ts
```

This will output your **Admin Key**. **IMPORTANT:** Save this key immediately - it won't be shown again!

Example output:
```
YOUR ADMIN KEY (for admin panel - SAVE THIS):
   ak_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Access the Admin Panel

1. Open your browser to `http://localhost:8787/public/`
2. You'll see the Admin Key Setup screen
3. Paste your admin key (starts with `ak_`)
4. Click **"Save & Continue"**
5. You're in!

## Logging In (After First Setup)

If you've already saved your admin key in the browser:
- Just visit `http://localhost:8787/public/`
- The dashboard will load automatically

If you need to re-enter your key:
1. Go to Settings → "Clear API Key & Log Out"
2. Enter your admin key again

## Next Steps After Logging In

### 1. Add Provider Keys (Required)

Before using the gateway, add at least one AI provider key:

1. Navigate to **"Provider Keys"** in the sidebar
2. Click **"Create Provider Key"**
3. Fill in:
   - **Name**: e.g., "My OpenAI Key"
   - **Provider**: Select provider (openai, anthropic, gemini, etc.)
   - **API Key**: Your actual provider API key
   - **Workspace**: Select "Default Workspace"
4. Click **"Create"**

### 2. Create Virtual Keys

Virtual keys are what your applications use to access the gateway:

1. Navigate to **"Virtual Keys"** in the sidebar
2. Click **"Create Virtual Key"**
3. Fill in:
   - **Name**: e.g., "Production App Key"
   - **Provider Key**: Select the provider key you created
   - **Rate Limits**: Optional RPM/TPM limits
   - **Allowed Models**: Optional model restrictions
4. Click **"Create"**
5. **IMPORTANT:** Save the generated key - it's only shown once!

### 3. Test the Gateway

Use your virtual key in the Playground or via API:

```bash
curl -X POST http://localhost:8787/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_VIRTUAL_KEY" \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

## Key Types

The gateway uses two types of keys:

### Admin Keys (`ak_*`)
- **Purpose**: Access the admin panel
- **Scope**: Full access to all resources
- **Header**: `x-axon-admin-key`
- **Used for**: Managing workspaces, users, provider keys, virtual keys

### Virtual Keys (`vk_*`)
- **Purpose**: Access the gateway API
- **Scope**: Workspace-specific with rate limits and model restrictions
- **Header**: `Authorization: Bearer vk_...` or `x-axon-api-key`
- **Used for**: Making AI requests through the gateway

## Troubleshooting

### "Invalid admin key" Error

**Solution:**
1. Make sure you copied the full key (starts with `ak_`)
2. Check for extra spaces at the beginning or end
3. If lost, run `npx tsx scripts/bootstrap.ts` to create a new workspace and admin key

### Session Expired / Auto Sign-Out

The gateway automatically signs you out if:
- Your admin key is invalid
- Your admin key has been revoked
- Your session has expired

**Solution:** Simply re-enter your admin key on the login screen.

### "Workspace context required" Error

This means the frontend couldn't load your workspace:

**Solution:**
1. Hard refresh your browser (Ctrl+F5 or Cmd+Shift+R)
2. Clear browser localStorage
3. Re-enter your admin key

### Server Won't Start

Make sure environment variables are set:

```bash
# Required
export ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Optional
export DATABASE_PATH="./data/gateway.db"
```

Or create a `.env` file:
```env
ENCRYPTION_KEY=your-secure-key
DATABASE_PATH=./data/gateway.db
```

## Security Best Practices

1. **Never commit admin keys to version control**
2. **Store admin keys securely** (password manager, secrets vault)
3. **Rotate keys regularly** in production
4. **Use different keys** for development/staging/production
5. **Revoke compromised keys** immediately via the admin panel

## Need Help

- Check [GETTING_STARTED.md](./GETTING_STARTED.md) for a complete setup guide
- Check [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed API documentation
- Open an issue on GitHub for bugs or feature requests


# Environment Setup Guide

Welcome to Axon AI Gateway! This guide explains how to configure environment variables for secure operation.

## Quick Start

Axon AI Gateway requires an `ENCRYPTION_KEY` environment variable to securely encrypt provider API keys stored in the database.

### 1. Environment Variables

A `.env` file has been automatically created for you with a secure encryption key. You can modify it as needed:

```bash
# View your .env file
cat .env
```

### 2. Required Variables

- **ENCRYPTION_KEY**: Used to encrypt provider API keys (32+ character string)
  - Already generated and configured
  - To generate a new one: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`

### 3. Optional Variables

```bash
# Database Path (defaults to ./data/gateway.db)
DATABASE_PATH=./data/gateway.db

# Server Port (defaults to 8787)
PORT=8787

# Environment (development, production)
ENVIRONMENT=development

# Log Level (debug, info, warn, error)
LOG_LEVEL=info
```

## How It Works

The gateway automatically loads environment variables from `.env` on startup using `dotenv`:

```typescript
// src/start-server.ts
import { config as dotenvConfig } from 'dotenv';
dotenvConfig();
```

## Security Notes

**Important:**
- Never commit `.env` to version control (already in `.gitignore`)
- Rotate your `ENCRYPTION_KEY` regularly in production
- Use different keys for development/staging/production
- Provider API keys are encrypted using AES-256-GCM

## Troubleshooting

### Error: "ENCRYPTION_KEY environment variable is not set"

**Solution:** Make sure:
1. `.env` file exists in the project root
2. Contains `ENCRYPTION_KEY=your-key-here`
3. Restart the server after creating/modifying `.env`

### Generate a New Encryption Key

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Copy the output to your `.env` file:

```bash
ENCRYPTION_KEY=paste-generated-key-here
```

## Deployment

For production deployments, set environment variables directly in your hosting platform:

**Vercel/Netlify:**
```bash
ENCRYPTION_KEY=your-production-key
```

**Docker:**
```bash
docker run -e ENCRYPTION_KEY=your-key your-image
```

**Kubernetes:**
Create a Secret and mount it as environment variables.

## Development Team Setup

For new team members:

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Generate your own encryption key:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" >> .env
   ```

3. Start the server:
   ```bash
   pnpm dev
   ```

## Status

**Setup Complete!** Your encryption key is configured and ready to use.

You can now:
- Create provider keys (OpenAI, Anthropic, etc.)
- Store encrypted API keys securely
- Use the admin dashboard at http://localhost:8787/public/


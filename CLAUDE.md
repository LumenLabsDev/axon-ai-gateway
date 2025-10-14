# CLAUDE.md

Quick reference for Claude when working with **Axon AI Gateway** - a fast AI gateway routing requests to 250+ LLMs with sub-1ms latency. Built with Hono framework, deploys to Cloudflare Workers and Node.js.

## Quick Start

```bash
npm run dev          # Cloudflare Workers dev server
npm run dev:node     # Node.js dev server
npm run build        # Production build
npm run test:gateway # Run gateway tests
npm run deploy       # Deploy to Cloudflare Workers
```

## Architecture Overview

**Hono-based HTTP server** with middleware pipeline:
- Routes: `/v1/chat/completions`, `/v1/completions`, `/v1/embeddings`, etc.
- Modular provider system (250+ LLMs)
- Plugin-based guardrails (PII, content safety, etc.)

**Key Paths:**
- `src/index.ts` - Cloudflare Workers entry
- `src/start-server.ts` - Node.js server entry
- `src/handlers/` - API route handlers
- `src/providers/` - AI provider adapters
- `src/middlewares/` - Auth, cache, logging, guardrails
- `plugins/` - Guardrail plugins (build with `npm run build-plugins`)

**Middleware Pipeline:**
`requestValidator` → `hooks` → `memoryCache` → `logger` → `axon` (routing/guardrails)

**Configs** (see `conf.json`):
JSON configurations for provider routing, fallbacks, load balancing, guardrails, caching, retries.

## Testing

- `src/tests/` - Core gateway tests
- `src/handlers/__tests__/` - Handler tests  
- `plugins/*/**.test.ts` - Plugin tests
- Timeout: 30s (jest.config.js)

## Runtime Notes

- ESM only (`"type": "module"`)
- Targets Node.js and Cloudflare Workers
- Guard Node-only APIs from worker paths
- Provider configs support streaming with backpressure handling

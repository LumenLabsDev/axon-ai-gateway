# Axon AI Gateway Documentation

Welcome to the Axon AI Gateway documentation! This guide will help you find what you need.

## Getting Started

**New to Axon?** Start here:

1. **[GETTING_STARTED.md](./GETTING_STARTED.md)** - Complete setup guide (5 minutes)
   - Install dependencies
   - Initialize database
   - Create admin key
   - Access admin panel
   - Make your first API call

2. **[LOGIN_INSTRUCTIONS.md](./LOGIN_INSTRUCTIONS.md)** - Admin panel login guide
   - How to access the admin panel
   - Key types explained
   - Troubleshooting login issues

3. **[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)** - Environment configuration
   - Required environment variables
   - Security best practices
   - Development vs production setup

## Core Documentation

### API & Database

- **[DATABASE_SETUP.md](./DATABASE_SETUP.md)** - Complete API reference
  - All admin endpoints documented
  - Virtual key management
  - Provider key management
  - Workspaces, users, prompts, guardrails
  - Rate limiting explained
  - Example workflows

### Deployment

- **[deploy-on-replit.md](./deploy-on-replit.md)** - Deploy to Replit
  - Step-by-step Replit deployment
  - Production configuration
  - Troubleshooting

- **[installation-deployments.md](./INSTALLATION-DEPLOYMENTS)** - All deployment options
  - Node.js server
  - Docker & Docker Compose
  - Cloudflare Workers
  - AWS EC2
  - And more...

## Quick Links

### For New Users
- [5-Minute Quickstart](./GETTING_STARTED.md#quick-start-5-minutes)
- [First Time Login](./LOGIN_INSTRUCTIONS.md#first-time-setup)
- [Environment Setup](./ENVIRONMENT_SETUP.md)

### For Developers
- [API Reference](./DATABASE_SETUP.md#api-endpoints)
- [Virtual Keys Guide](./DATABASE_SETUP.md#virtual-keys-gateway-access-with-rate-limits)
- [Provider Keys Guide](./DATABASE_SETUP.md#provider-keys)
- [Rate Limiting](./DATABASE_SETUP.md#rate-limiting)

### For DevOps
- [Deployment Options](./installation-deployments.md)
- [Docker Setup](./installation-deployments.md#docker)
- [Production Best Practices](./DATABASE_SETUP.md#security-best-practices)
- [Environment Variables](./ENVIRONMENT_SETUP.md)

## Concepts

### Key Types

Axon AI Gateway uses two types of authentication keys:

#### Admin Keys (`ak_*`)
- **Purpose**: Access the admin panel and manage resources
- **Created**: Via bootstrap script (`npx tsx scripts/bootstrap.ts`)
- **Used for**: Managing workspaces, users, provider keys, virtual keys
- **Header**: `x-axon-admin-key`
- **No rate limits**

#### Virtual Keys (`vk_*`)
- **Purpose**: Access the gateway API from your applications
- **Created**: Via admin panel
- **Used for**: Making AI requests (chat completions, embeddings, etc.)
- **Header**: `Authorization: Bearer vk_...` or `x-axon-api-key`
- **Features**: Rate limits, model restrictions, usage tracking

### Architecture

```
Your Application
    ↓ (uses virtual key)
Axon AI Gateway
    ├── Authentication
    ├── Rate Limiting
    ├── Model Validation
    └── Request Routing
        ↓ (uses provider key - encrypted)
AI Provider (OpenAI, Anthropic, etc.)
```

### Workflow

1. **Setup** → Run bootstrap script to get admin key
2. **Login** → Access admin panel with admin key
3. **Add Provider** → Store your OpenAI/Anthropic/etc. API key (encrypted)
4. **Create Virtual Key** → Generate key for your app with rate limits
5. **Use Gateway** → Make AI requests using virtual key
6. **Monitor** → Track usage and costs in admin panel

## Security

### Best Practices

1. **Never commit keys to version control**
   - Use environment variables
   - Add `.env` to `.gitignore`

2. **Rotate keys regularly**
   - Create new keys
   - Revoke old ones in admin panel

3. **Use different keys for different environments**
   - Development: No rate limits
   - Production: Strict rate limits

4. **Set the ENCRYPTION_KEY securely**
   - Generate with: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - Store in environment variables, not in code

5. **Monitor usage**
   - Check analytics regularly
   - Set alerts for unusual activity

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| "Invalid admin key" | Check you copied the full key (starts with `ak_`) |
| "ENCRYPTION_KEY not set" | Run setup command in [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md) |
| "Workspace context required" | Hard refresh browser (Ctrl+F5) |
| Virtual key not working | Check it's active and not expired in admin panel |
| Server won't start | Check environment variables and port 8787 availability |
| "Model not allowed" | Add model to virtual key's allowed models list |

See detailed troubleshooting in:
- [GETTING_STARTED.md - Troubleshooting](./GETTING_STARTED.md#troubleshooting)
- [LOGIN_INSTRUCTIONS.md - Troubleshooting](./LOGIN_INSTRUCTIONS.md#troubleshooting)
- [DATABASE_SETUP.md - Troubleshooting](./DATABASE_SETUP.md#troubleshooting)

## Getting Help

- **Documentation**: You're reading it! Explore the guides above
- **Issues**: Open an issue on GitHub
- **Community**: Join discussions on GitHub
- **Server Logs**: Check console output for detailed error messages

## Contributing

Want to improve the docs? We welcome contributions!

1. Fork the repository
2. Make your changes
3. Submit a pull request

Documentation improvements are especially appreciated:
- Fixing typos
- Adding examples
- Clarifying confusing sections
- Translating to other languages

## Document Map

```
docs/
├── README.md (you are here)
├── GETTING_STARTED.md         → Setup & first steps
├── LOGIN_INSTRUCTIONS.md      → Admin panel access
├── ENVIRONMENT_SETUP.md       → Environment config
├── DATABASE_SETUP.md          → Complete API reference
├── IMPLEMENTATION_STATUS.md   → Current status & roadmap
├── deploy-on-replit.md        → Replit deployment
└── installation-deployments.md → All deployment options
```

## Next Steps

1. **Not installed yet?** → [GETTING_STARTED.md](./GETTING_STARTED.md)
2. **Need to log in?** → [LOGIN_INSTRUCTIONS.md](./LOGIN_INSTRUCTIONS.md)
3. **Want to deploy?** → [installation-deployments.md](./installation-deployments.md)
4. **Need API docs?** → [DATABASE_SETUP.md](./DATABASE_SETUP.md)

---

**Ready to build?** Start with the [5-Minute Quickstart](./GETTING_STARTED.md#quick-start-5-minutes)


<div align="center">
<img src="/docs/images/gateway-border.png" width=350>

# Axon AI Gateway
### Route to 100+ LLMs with 1 fast & friendly API.

</div>
<br><br>

Axon AI Gateway is a unified interface for accessing multiple AI providers through a single API. It streamlines API requests to OpenAI, Anthropic, Mistral, Google Gemini, and more with consistent authentication and rate limiting.

## Key Features

- **Unified API** - One endpoint for 100+ LLM providers
- **Load balancing** - Distribute requests across models and providers
- **Automatic retries** - Built-in retry logic with exponential backoff
- **Rate limiting** - Control costs with RPM/TPM limits
- **Model restrictions** - Limit which models can be accessed
- **Secure key storage** - Encrypted provider API keys
- **Admin dashboard** - Beautiful UI for managing everything



### Deploy on Replit

Follow these steps to deploy Axon AI Gateway on Replit:

#### 1. Fork the Repository

1. Visit the [Axon AI Gateway repository](https://github.com/your-org/axon-ai-gateway)
2. Fork it to your Replit account
3. Give it a meaningful name (e.g., "my-ai-gateway")

#### 2. Set Environment Variables

In your Replit project, add these secrets (Environment Variables):

```bash
ENCRYPTION_KEY=your-secure-encryption-key-here
DATABASE_PATH=/home/runner/data/gateway.db
```

Generate a secure encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

#### 3. Run Initial Setup

Click [Run] or execute in the shell:

```bash
# Install dependencies
npm install

# Initialize database and create admin key
npx tsx scripts/bootstrap.ts
```

**IMPORTANT:** Save the admin key that's displayed - you'll need it to access the admin panel!

#### 4. Start the Server

The server will start automatically on Replit, typically at:
- Development: `https://unique-random-numbers.xxx.repl.co/`
- Production: `https://chosen-subdomain.replit.app/`

#### 5. Access Admin Panel

1. Open your Replit URL + `/public/`
2. Enter the admin key you saved from step 3
3. Add provider keys (OpenAI, Anthropic, etc.)
4. Create virtual keys for your applications

### Example Usage

Once deployed, use your virtual key to make requests:

```bash
# Using virtual key (recommended)
curl 'https://your-replit-url.replit.app/v1/chat/completions' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_VIRTUAL_KEY' \
  -d '{
    "model": "gpt-4o",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

### Production Deployment

For production deployment on Replit:

1. Click **[Deploy]** in the top right (requires Replit Core)
2. Choose your subdomain (e.g., `my-ai-gateway.replit.app`)
3. Configure autoscaling if needed
4. Update your application to use the production URL

### Features on Replit

- **Always-on**: Runs 24/7 with Replit Core
- **SQLite database**: Persistent storage in `/home/runner/data/`
- **Secure secrets**: Environment variables protected
- **Custom domain**: Use your own domain with Replit
- **Auto-scaling**: Handle high traffic automatically

### Troubleshooting

**Server won't start:**
- Check that `ENCRYPTION_KEY` is set in Secrets
- Ensure the `data/` directory exists
- Check the logs in the Replit console

**Can't access admin panel:**
- Make sure you're visiting `/public/` (e.g., `https://your-url.replit.app/public/`)
- Check that you have the correct admin key
- Try running `npx tsx scripts/bootstrap.ts` again

**Database issues:**
- Replit may reset files on redeploy
- Use `/home/runner/data/` path for persistence
- Consider backing up the database regularly

### Next Steps

- Read the [Getting Started Guide](./GETTING_STARTED.md)
- Explore the [Database Setup Documentation](./DATABASE_SETUP.md)
- Check the [Admin Panel Login Guide](./LOGIN_INSTRUCTIONS.md)

### About Axon AI Gateway

Axon AI Gateway is built for developers who need a unified interface to multiple AI providers with built-in cost controls, monitoring, and security. Perfect for:

- **Enterprise apps** - Multi-tenant workspaces with role-based access
- **Startups** - Quick integration with rate limiting to control costs
- **Research** - Easy switching between models and providers
- **Side projects** - Simple setup with a beautiful admin dashboard

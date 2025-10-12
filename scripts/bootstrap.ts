#!/usr/bin/env tsx
/**
 * Bootstrap script to create initial workspace, admin user, and API key
 * Run with: tsx scripts/bootstrap.ts
 */

import { initializeDatabase, getDb } from '../src/db/index';
import { workspaces, users, apiKeys } from '../src/db/schema';
import { hashSync } from 'bcryptjs';
import { randomBytes } from 'crypto';
import { exit } from 'process';
import dotenv from 'dotenv';

dotenv.config();

async function bootstrap() {
  console.log('🚀 Starting bootstrap process...\n');
  
  // Check for encryption key
  if (!process.env.ENCRYPTION_KEY) {
    console.error('❌ ERROR: ENCRYPTION_KEY environment variable is not set!');
    console.error('   Please set it before running bootstrap:');
    console.error('   export ENCRYPTION_KEY="your-secure-key-here"\n');
    exit(1);
  }
  
  try {
    // Initialize database
    console.log('📦 Initializing database...');
    await initializeDatabase();
    const db = getDb();
    console.log('✅ Database initialized\n');
    
    // Create workspace
    console.log('🏢 Creating workspace...');
    const workspaceResult = await db.insert(workspaces).values({
      name: 'Default Workspace',
      description: 'Initial workspace created by bootstrap',
      metadata: {},
    }).returning();
    const workspace = workspaceResult[0];
    console.log(`✅ Workspace created: ${workspace.id}\n`);
    
    // Create admin user
    console.log('👤 Creating admin user...');
    const userResult = await db.insert(users).values({
      workspaceId: workspace.id,
      email: 'admin@localhost',
      name: 'Admin User',
      role: 'admin',
    }).returning();
    const user = userResult[0];
    console.log(`✅ Admin user created: ${user.email}\n`);
    
    // Generate API key
    console.log('🔑 Generating API key...');
    const plainKey = `pk_${randomBytes(32).toString('base64url')}`;
    const keyHash = hashSync(plainKey, 10);
    
    const apiKeyResult = await db.insert(apiKeys).values({
      workspaceId: workspace.id,
      keyHash,
      name: 'Bootstrap Admin Key',
      description: 'Initial API key with full permissions',
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
        'completions.create': true,
      },
      rateLimitRpm: null, // No rate limit for admin key
      rateLimitTpm: null,
      createdBy: user.id,
      isActive: true,
    }).returning();
    const apiKey = apiKeyResult[0];
    
    console.log('✅ API key created\n');
    console.log('═'.repeat(80));
    console.log('🎉 BOOTSTRAP COMPLETE!\n');
    console.log('📋 Details:');
    console.log(`   Workspace ID:  ${workspace.id}`);
    console.log(`   Workspace Name: ${workspace.name}`);
    console.log(`   User ID:       ${user.id}`);
    console.log(`   User Email:    ${user.email}`);
    console.log(`   API Key ID:    ${apiKey.id}\n`);
    
    console.log('🔐 YOUR API KEY (SAVE THIS - IT WILL NOT BE SHOWN AGAIN):');
    console.log(`   ${plainKey}\n`);
    console.log('═'.repeat(80));
    console.log('\n📝 Next steps:');
    console.log('   1. Save the API key in a secure location');
    console.log('   2. Add provider keys: POST /v1/admin/provider-keys');
    console.log('   3. Create additional API keys with specific permissions');
    console.log('   4. Start the server: npm run dev:node');
    console.log('   5. Test with: curl -H "x-axon-api-key: YOUR_KEY" http://localhost:8787/v1/admin/workspaces\n');
    
  } catch (error: any) {
    console.error('\n❌ Bootstrap failed:', error.message);
    console.error(error.stack);
    exit(1);
  }
}

// Run bootstrap
bootstrap().then(() => {
  console.log('✨ Bootstrap script completed successfully!\n');
  process.exit(0);
}).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});


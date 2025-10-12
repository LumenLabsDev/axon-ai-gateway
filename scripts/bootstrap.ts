#!/usr/bin/env tsx
/**
 * Bootstrap script to create initial workspace, admin user, and admin key
 * Run with: tsx scripts/bootstrap.ts
 */

import { initializeDatabase, getDb } from '../src/db/index';
import { workspaces, users, adminKeys } from '../src/db/schema';
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
    
    // Generate Admin Key (for admin panel access)
    console.log('🔑 Generating Admin Key (for admin panel)...');
    const plainAdminKey = `ak_${randomBytes(32).toString('base64url')}`;
    const adminKeyHash = hashSync(plainAdminKey, 10);
    
    const adminKeyResult = await db.insert(adminKeys).values({
      keyHash: adminKeyHash,
      name: 'Bootstrap Admin Key',
      description: 'Initial admin key for accessing the admin panel',
      isActive: true,
    }).returning();
    const adminKey = adminKeyResult[0];
    console.log('✅ Admin key created\n');
    
    console.log('═'.repeat(80));
    console.log('🎉 BOOTSTRAP COMPLETE!\n');
    console.log('📋 Details:');
    console.log(`   Workspace ID:     ${workspace.id}`);
    console.log(`   Workspace Name:   ${workspace.name}`);
    console.log(`   User ID:          ${user.id}`);
    console.log(`   User Email:       ${user.email}`);
    console.log(`   Admin Key ID:     ${adminKey.id}\n`);
    
    console.log('🔐 YOUR ADMIN KEY (for admin panel - SAVE THIS):');
    console.log(`   ${plainAdminKey}\n`);
    
    console.log('═'.repeat(80));
    console.log('\n📝 Next steps:');
    console.log('   1. Save the admin key in a secure location');
    console.log('   2. Start the server: npm run dev:node');
    console.log('   3. Add provider keys (OpenAI, Anthropic, etc.):');
    console.log('      POST /v1/admin/provider-keys');
    console.log('      Body: { "workspaceId": "YOUR_WORKSPACE_ID", "name": "OpenAI Key", "provider": "openai", "apiKey": "sk-..." }');
    console.log('   4. Create virtual keys linked to your provider keys:');
    console.log('      POST /v1/admin/virtual-keys');
    console.log('      Body: { "workspaceId": "YOUR_WORKSPACE_ID", "providerKeyId": "PROVIDER_KEY_ID", "name": "My App Key", "allowedModels": ["gpt-4o"] }');
    console.log('   5. Use virtual keys to access the gateway:');
    console.log('      curl -H "x-axon-api-key: YOUR_VIRTUAL_KEY" http://localhost:8787/v1/chat/completions\n');
    
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


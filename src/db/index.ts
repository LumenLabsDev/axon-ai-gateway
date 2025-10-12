import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from './schema';
import { mkdir } from 'fs/promises';
import { dirname } from 'path';
import { existsSync } from 'fs';

// Get database path from environment or use default
const DATABASE_PATH = process.env.DATABASE_PATH || './data/gateway.db';

let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let sqlite: Database.Database | null = null;

/**
 * Initialize the database connection
 * Creates the data directory if it doesn't exist
 */
export async function initializeDatabase() {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] [DB] [INFO] Initializing database at: ${DATABASE_PATH}`);

  try {
    // Ensure the directory exists
    const dir = dirname(DATABASE_PATH);
    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
      console.log(`[${timestamp}] [DB] [INFO] Created database directory: ${dir}`);
    }

    // Initialize SQLite connection
    sqlite = new Database(DATABASE_PATH);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');

    // Create Drizzle instance
    db = drizzle(sqlite, { schema });

    console.log(`[${timestamp}] [DB] [INFO] Database initialized successfully`);
    return db;
  } catch (error: any) {
    console.error(`[${timestamp}] [DB] [ERROR] Failed to initialize database:`, error.message);
    throw error;
  }
}

/**
 * Get the database instance
 * Throws if database hasn't been initialized
 */
export function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return db;
}

/**
 * Get the raw SQLite instance
 */
export function getSqlite() {
  if (!sqlite) {
    throw new Error('Database not initialized. Call initializeDatabase() first.');
  }
  return sqlite;
}

/**
 * Close the database connection
 */
export function closeDatabase() {
  const timestamp = new Date().toISOString();
  if (sqlite) {
    sqlite.close();
    console.log(`[${timestamp}] [DB] [INFO] Database connection closed`);
    db = null;
    sqlite = null;
  }
}

// Export schema for use in queries
export * from './schema';


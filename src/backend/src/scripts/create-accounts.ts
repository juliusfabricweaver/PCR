#!/usr/bin/env node
/**
 * Script to create admin and user accounts in the PCR database
 * Usage: npm run create-accounts
 */

import { DatabaseService } from '../database/database.service';
import { AuthenticationService } from '../services/auth.service';

// Default configuration for the script
const DEFAULT_CONFIG = {
  database: {
    filename: './src/backend/data/pcr.db',
    maxConnections: 10,
    busyTimeout: 10000,
    enableForeignKeys: true
  },
  auth: {
    jwtSecret: 'default-jwt-secret-change-in-production',
    jwtExpiresIn: '15m',
    refreshSecret: 'default-refresh-secret-change-in-production',
    refreshExpiresIn: '7d',
    bcryptRounds: 12,
    maxLoginAttempts: 5,
    lockoutDuration: 1800,
    sessionTimeout: 900
  }
};

// Account configurations
const ACCOUNTS = {
  admin: {
    username: process.env.ADMIN_USERNAME || 'admin',
    password: process.env.ADMIN_PASSWORD || 'Admin123!',
    role: 'admin' as const
  },
  user: {
    username: process.env.USER_USERNAME || 'user',
    password: process.env.USER_PASSWORD || 'User123!',
    role: 'user' as const
  }
};

async function createAccounts(): Promise<void> {
  let dbService: DatabaseService | null = null;
  let authService: AuthenticationService | null = null;

  try {
    console.log('🚀 Starting account creation script...\n');

    // Initialize database service
    console.log('📊 Initializing database...');
    dbService = new DatabaseService(DEFAULT_CONFIG.database);
    await dbService.connect();
    console.log('✅ Database connected successfully\n');

    // Initialize auth service
    console.log('🔐 Initializing authentication service...');
    authService = new AuthenticationService(dbService, DEFAULT_CONFIG.auth);
    console.log('✅ Authentication service initialized\n');

    // Create admin account
    console.log('👨‍💼 Creating admin account...');
    try {
      // Check if admin already exists
      const existingAdmin = await dbService.findOne('users', {
        where: { username: ACCOUNTS.admin.username }
      });

      if (existingAdmin) {
        console.log(`⚠️  Admin account '${ACCOUNTS.admin.username}' already exists, skipping...`);
      } else {
        const adminUser = await authService.createUser({
          username: ACCOUNTS.admin.username,
          password: ACCOUNTS.admin.password,
          role: ACCOUNTS.admin.role
        });
        console.log(`✅ Admin account created successfully:`);
        console.log(`   - Username: ${adminUser.username}`);
        console.log(`   - Role: ${adminUser.role}`);
        console.log(`   - ID: ${adminUser.id}`);
      }
    } catch (error) {
      console.error('❌ Failed to create admin account:', error);
      throw error;
    }

    console.log();

    // Create user account
    console.log('👤 Creating user account...');
    try {
      // Check if user already exists
      const existingUser = await dbService.findOne('users', {
        where: { username: ACCOUNTS.user.username }
      });

      if (existingUser) {
        console.log(`⚠️  User account '${ACCOUNTS.user.username}' already exists, skipping...`);
      } else {
        const regularUser = await authService.createUser({
          username: ACCOUNTS.user.username,
          password: ACCOUNTS.user.password,
          role: ACCOUNTS.user.role
        });
        console.log(`✅ User account created successfully:`);
        console.log(`   - Username: ${regularUser.username}`);
        console.log(`   - Role: ${regularUser.role}`);
        console.log(`   - ID: ${regularUser.id}`);
      }
    } catch (error) {
      console.error('❌ Failed to create user account:', error);
      throw error;
    }

    console.log();

    // Display summary
    const allUsers = await dbService.find('users', {
      orderBy: 'created_at ASC'
    });

    console.log('📋 Account Summary:');
    console.log('═'.repeat(50));
    allUsers.forEach((user: any, index: number) => {
      console.log(`${index + 1}. ${user.username} (${user.role}) - Created: ${new Date(user.created_at).toLocaleDateString()}`);
    });
    console.log('═'.repeat(50));

    console.log('\n🎉 Account creation completed successfully!');
    console.log('\n📝 Account Credentials:');
    console.log(`Admin - Username: ${ACCOUNTS.admin.username}, Password: ${ACCOUNTS.admin.password}`);
    console.log(`User  - Username: ${ACCOUNTS.user.username}, Password: ${ACCOUNTS.user.password}`);
    console.log('\n⚠️  Remember to change these default passwords in production!');

  } catch (error) {
    console.error('\n💥 Account creation failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    if (dbService) {
      await dbService.close();
      console.log('\n🔌 Database connection closed');
    }
  }
}

// Run the script
if (require.main === module) {
  createAccounts().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { createAccounts, ACCOUNTS, DEFAULT_CONFIG };
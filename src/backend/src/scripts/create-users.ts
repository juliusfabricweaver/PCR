import bcrypt from 'bcrypt';
import db from '../database';

// Generate simple ID
function generateId(prefix: string): string {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

async function createDefaultUsers() {
  console.log('Creating default users...');

  try {
    // Check if admin user already exists
    const existingAdmin = db.prepare('SELECT id FROM users WHERE username = ?').get('admin');

    if (!existingAdmin) {
      const adminPasswordHash = await bcrypt.hash('admin', 10);

      db.prepare(`
        INSERT INTO users (id, username, password_hash, first_name, last_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId('user'),
        'admin',
        adminPasswordHash,
        'System',
        'Administrator',
        'admin',
        1
      );

      console.log('✅ Admin user created (username: admin, password: admin)');
    } else {
      console.log('ℹ️ Admin user already exists');
    }

    // Check if regular user exists
    const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get('user');

    if (!existingUser) {
      const userPasswordHash = await bcrypt.hash('user', 10);

      db.prepare(`
        INSERT INTO users (id, username, password_hash, first_name, last_name, role, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        generateId('user'),
        'user',
        userPasswordHash,
        'Regular',
        'User',
        'user',
        1
      );

      console.log('✅ Regular user created (username: user, password: user)');
    } else {
      console.log('ℹ️ Regular user already exists');
    }

    console.log('\n🎉 Default users setup complete!');
    console.log('You can now login with:');
    console.log('  Admin: username=admin, password=admin');
    console.log('  User:  username=user, password=user');

  } catch (error) {
    console.error('❌ Error creating users:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  createDefaultUsers()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Failed to create users:', error);
      process.exit(1);
    });
}

export { createDefaultUsers };
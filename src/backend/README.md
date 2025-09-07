# PCR Application Backend

A secure, robust backend API for the Patient Care Report (PCR) application built with Node.js, TypeScript, Express, and SQLite.

## Features

### 🔐 Security
- **Authentication**: JWT tokens with refresh tokens
- **Authorization**: Role-based access control (admin/user)
- **Encryption**: AES-256-GCM for sensitive data (drafts)
- **Password Security**: bcrypt with configurable salt rounds
- **Rate Limiting**: Protection against brute force attacks
- **Account Lockout**: Temporary lockout after failed attempts
- **Session Management**: Secure session handling with timeout

### 📊 Database
- **SQLite**: Local database with WAL mode for performance
- **Migrations**: Automatic schema versioning and updates
- **Connection Pooling**: Efficient database connections
- **Prepared Statements**: SQL injection prevention
- **Transactions**: ACID compliance for data integrity
- **Backup/Restore**: Built-in database backup utilities

### 🔍 Logging & Monitoring
- **Structured Logging**: Winston with daily log rotation
- **Audit Trail**: Complete activity logging
- **Security Events**: Authentication and authorization logging
- **Performance Metrics**: Request timing and database performance
- **Health Checks**: System status monitoring

### 🛡️ Error Handling
- **Custom Error Classes**: Specific error types for different scenarios
- **Graceful Degradation**: Proper error responses
- **Input Validation**: Joi schema validation
- **Sanitization**: Input cleaning and XSS protection

## Project Structure

```
src/backend/
├── src/
│   ├── config/           # Configuration management
│   ├── database/         # Database services and migrations
│   ├── controllers/      # Request handlers
│   ├── middleware/       # Express middleware
│   ├── models/           # Data models (future use)
│   ├── routes/           # API routes
│   ├── services/         # Business logic services
│   ├── types/            # TypeScript type definitions
│   ├── utils/            # Utility functions
│   ├── tests/            # Unit tests
│   └── index.ts          # Main server entry point
├── dist/                 # Compiled JavaScript
├── logs/                 # Application logs
├── backups/              # Database backups
├── package.json          # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── jest.config.js        # Test configuration
└── .env.example          # Environment variables template
```

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

1. **Clone and navigate to backend directory:**
   ```bash
   cd src/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Create environment file:**
   ```bash
   cp .env.example .env
   ```

4. **Configure environment variables** (see Configuration section)

5. **Build the project:**
   ```bash
   npm run build
   ```

6. **Start the server:**
   ```bash
   npm start
   ```

For development with auto-reload:
```bash
npm run dev
```

## Configuration

### Environment Variables

Create a `.env` file with the following required variables:

```env
# Environment
NODE_ENV=development

# Server
PORT=3001
HOST=localhost

# Database
DB_FILENAME=pcr-app.sqlite
DB_MAX_CONNECTIONS=10
DB_BUSY_TIMEOUT=30000
DB_ENABLE_FOREIGN_KEYS=true

# JWT (REQUIRED - Use strong random strings)
JWT_SECRET=your-super-secure-jwt-secret-key-at-least-32-characters-long
REFRESH_TOKEN_SECRET=your-super-secure-refresh-token-secret-different-from-jwt

# Encryption (REQUIRED)
ENCRYPTION_MASTER_PASSWORD=your-encryption-master-password-minimum-16-chars

# Security
BCRYPT_ROUNDS=12
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=1800
SESSION_TIMEOUT=900

# Admin Account (REQUIRED for initial setup)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-admin-password

# Logging
LOG_LEVEL=info
LOG_MAX_FILES=14
LOG_MAX_SIZE=10m
```

### Security Recommendations

1. **Generate Strong Secrets:**
   ```bash
   # Generate JWT secret (32+ chars)
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   
   # Generate encryption password (16+ chars)
   node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
   ```

2. **Use Different Secrets:** JWT and refresh token secrets must be different

3. **Strong Admin Password:** Minimum 8 characters with mixed case, numbers, and symbols

## API Endpoints

### Authentication (`/api/auth`)
- `POST /login` - User login
- `POST /logout` - User logout  
- `GET /validate` - Validate token/session
- `POST /refresh` - Refresh access token
- `POST /change-password` - Change password
- `GET /profile` - Get user profile
- `GET /sessions` - Get user sessions
- `GET /stats` - Auth statistics (admin)
- `POST /unlock/:username` - Unlock account (admin)

### Users (`/api/users`)
- `GET /` - List users (admin)
- `POST /` - Create user (admin)
- `GET /:id` - Get user (self/admin)
- `PUT /:id` - Update user (self/admin)
- `DELETE /:id` - Delete user (admin)
- `GET /:id/stats` - User statistics (admin)
- `POST /:id/reset-password` - Reset password (admin)

### Drafts (`/api/drafts`)
- `GET /` - Get user drafts
- `POST /` - Save draft
- `GET /:id` - Get specific draft
- `PUT /:id` - Update draft
- `DELETE /:id` - Delete draft
- `GET /all` - All drafts (admin)
- `GET /stats` - Draft statistics (admin)

### Submissions (`/api/submissions`)
- `GET /` - Get user submissions
- `POST /` - Create submission
- `GET /:id` - Get specific submission
- `DELETE /:id` - Delete submission (limited time)
- `GET /all` - All submissions (admin)
- `GET /stats` - Submission statistics (admin)
- `GET /export` - Export as CSV (admin)

### Logs (`/api/logs`)
- `GET /` - Get logs with filters (admin)
- `GET /user` - Get user's logs
- `GET /stats` - Log statistics (admin)
- `GET /recent` - Recent activity
- `GET /export` - Export logs (admin)
- `GET /audit/:type/:id` - Audit trail (admin)

### System (`/api`)
- `GET /health` - Health check
- `GET /info` - API information
- `POST /backup` - Create backup (admin)
- `GET /backups` - List backups (admin)
- `POST /restore` - Restore backup (admin)

## Database Schema

### Core Tables

**users**
- User accounts with roles (admin/user)
- Password hashing with bcrypt
- Account creation/update timestamps

**drafts**
- Encrypted form data (AES-256-GCM)
- Auto-expiration (24 hours default)
- User-specific access

**submissions**
- Completed form data (JSON)
- Immutable after submission
- Admin/user access controls

**logs**
- Complete audit trail
- User actions and system events
- Security event tracking

### Support Tables

**sessions**
- Active user sessions
- Session timeout management
- Activity tracking

**login_attempts**
- Failed login tracking
- Account lockout management
- IP-based rate limiting

**migrations**
- Schema version tracking
- Automatic migrations

## Development

### Scripts

```bash
npm run build       # Compile TypeScript
npm run start       # Start production server
npm run dev         # Start development server with hot reload
npm run test        # Run unit tests
npm run test:watch  # Run tests in watch mode
npm run lint        # Check code style
npm run lint:fix    # Fix code style issues
```

### Testing

The project includes comprehensive unit tests:

```bash
# Run all tests
npm test

# Run specific test file
npm test -- encryption.test.ts

# Run tests with coverage
npm test -- --coverage

# Watch mode for development
npm run test:watch
```

### Database Migrations

Migrations run automatically on startup. To create new migrations:

1. Add SQL to `src/database/migrations.ts`
2. Update version number
3. Restart server

### Backup and Restore

**Create Backup:**
```bash
curl -X POST http://localhost:3001/api/backup \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"includeData": true, "compress": true}'
```

**Restore Backup:**
```bash
curl -X POST http://localhost:3001/api/restore \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{"source": "./backups/backup-file.sql.gz", "overwrite": true}'
```

## Security Considerations

### Data Protection
- **Encryption at Rest**: Draft data encrypted with AES-256-GCM
- **Password Security**: bcrypt with 12+ rounds
- **Token Security**: JWT with short expiration, refresh tokens
- **Session Security**: Secure session management with timeout

### Access Control
- **Role-Based**: Admin/user roles with appropriate permissions
- **Route Protection**: All sensitive endpoints require authentication
- **Data Isolation**: Users can only access their own data

### Attack Prevention
- **Rate Limiting**: Prevents brute force attacks
- **Input Validation**: All inputs validated and sanitized
- **SQL Injection**: Prepared statements only
- **XSS Protection**: Input sanitization and output encoding
- **CSRF Protection**: Token-based authentication

## Monitoring

### Logging Levels
- **error**: System errors and failures
- **warn**: Security events and warnings  
- **info**: User actions and system events
- **debug**: Detailed operation information

### Log Files
- `logs/app-YYYY-MM-DD.log` - Application logs
- `logs/error-YYYY-MM-DD.log` - Error logs only
- `logs/security-YYYY-MM-DD.log` - Security events
- `logs/exceptions.log` - Unhandled exceptions

### Health Monitoring
- `GET /api/health` - System health status
- Database connectivity
- Encryption service status
- Active session count

## Performance

### Database Optimization
- WAL mode for concurrent access
- Prepared statements for frequent queries
- Indexes on commonly queried columns
- Periodic PRAGMA optimize

### Caching
- In-memory session storage
- Prepared statement caching
- Connection pooling

### Resource Management
- Automatic cleanup of expired data
- Log rotation to prevent disk usage issues
- Memory monitoring and limits

## Deployment

### Production Checklist

1. **Environment Configuration:**
   - Set `NODE_ENV=production`
   - Use strong, unique secrets
   - Configure appropriate log level

2. **Security:**
   - Change default admin password
   - Use HTTPS proxy (nginx/Apache)
   - Configure firewall rules
   - Regular security updates

3. **Monitoring:**
   - Set up log monitoring
   - Configure health check alerts
   - Monitor disk space for logs/database

4. **Backup Strategy:**
   - Schedule regular backups
   - Test restore procedures
   - Store backups securely

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist/ ./dist/
COPY logs/ ./logs/
COPY backups/ ./backups/

EXPOSE 3001
CMD ["npm", "start"]
```

## Troubleshooting

### Common Issues

**Database Locked:**
- Check for long-running transactions
- Verify WAL mode is enabled
- Increase busy timeout

**Authentication Failures:**
- Verify JWT secrets are set correctly
- Check token expiration times
- Review rate limiting configuration

**Performance Issues:**
- Monitor log file sizes
- Check database query performance
- Review connection pool settings

### Debug Mode

Enable debug logging:
```env
LOG_LEVEL=debug
```

This will provide detailed information about:
- Database queries and performance
- Authentication attempts
- Session management
- Request/response details

## License

This project is licensed under the MIT License.

## Support

For support and questions:
- Check the logs for error details
- Review configuration settings
- Consult the API documentation
- Run health checks for system status
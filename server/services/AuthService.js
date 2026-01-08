/**
 * AuthService
 * Handles authentication, authorization, and audit logging
 */
const crypto = require('crypto');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { serviceLogger } = require('../utils/logger');

class AuthService {
  /**
   * @param {import('pg').Pool} pool
   */
  constructor(pool) {
    this.pool = pool;
    this.logger = serviceLogger.child({ service: 'auth' });
  }

  // ============================================
  // PASSWORD HASHING (Simple bcrypt-like using crypto)
  // ============================================

  hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return `${salt}:${hash}`;
  }

  verifyPassword(password, storedHash) {
    const [salt, hash] = storedHash.split(':');
    const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  // ============================================
  // USER MANAGEMENT
  // ============================================

  async createUser(input) {
    const { email, password, first_name, last_name, role = 'viewer', employee_id = null } = input;

    // Check if email already exists
    const existing = await this.pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rows.length > 0) {
      throw new ValidationError('Email already registered');
    }

    const passwordHash = this.hashPassword(password);

    const result = await this.pool.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, role, employee_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, first_name, last_name, role, employee_id, is_active, created_at`,
      [email.toLowerCase(), passwordHash, first_name, last_name, role, employee_id]
    );

    this.logger.info({ userId: result.rows[0].id, email }, 'User created');

    return result.rows[0];
  }

  async login(email, password, ipAddress = null, userAgent = null) {
    const result = await this.pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      throw new ValidationError('Invalid email or password');
    }

    const user = result.rows[0];

    // Check if account is locked
    if (user.locked_until && new Date(user.locked_until) > new Date()) {
      throw new ValidationError('Account is temporarily locked. Try again later.');
    }

    // Check if account is active
    if (!user.is_active) {
      throw new ValidationError('Account is deactivated');
    }

    // Verify password
    if (!this.verifyPassword(password, user.password_hash)) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      const lockUntil = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // Lock for 15 mins after 5 fails

      await this.pool.query(
        'UPDATE users SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [attempts, lockUntil, user.id]
      );

      throw new ValidationError('Invalid email or password');
    }

    // Reset failed attempts
    await this.pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL, last_login = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generate session token
    const token = this.generateToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await this.pool.query(
      `INSERT INTO sessions (user_id, token_hash, expires_at, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [user.id, tokenHash, expiresAt, ipAddress, userAgent]
    );

    this.logger.info({ userId: user.id, email }, 'User logged in');

    return {
      token,
      expires_at: expiresAt,
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
    };
  }

  async logout(token) {
    const tokenHash = this.hashToken(token);
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async validateToken(token) {
    const tokenHash = this.hashToken(token);
    const result = await this.pool.query(
      `SELECT s.*, u.id as user_id, u.email, u.first_name, u.last_name, u.role, u.is_active
       FROM sessions s
       JOIN users u ON s.user_id = u.id
       WHERE s.token_hash = $1 AND s.expires_at > CURRENT_TIMESTAMP`,
      [tokenHash]
    );

    if (result.rows.length === 0) {
      return null;
    }

    const session = result.rows[0];
    if (!session.is_active) {
      return null;
    }

    return {
      id: session.user_id,
      email: session.email,
      first_name: session.first_name,
      last_name: session.last_name,
      role: session.role,
    };
  }

  // ============================================
  // AUTHORIZATION
  // ============================================

  async checkPermission(role, resource, action) {
    // Admin has all permissions
    if (role === 'admin') {
      return true;
    }

    // Check specific permission
    const result = await this.pool.query(
      `SELECT id FROM role_permissions
       WHERE role = $1 AND (resource = $2 OR resource = 'all') AND action = $3`,
      [role, resource, action]
    );

    return result.rows.length > 0;
  }

  async getPermissionsForRole(role) {
    const result = await this.pool.query(
      'SELECT resource, action FROM role_permissions WHERE role = $1',
      [role]
    );
    return result.rows;
  }

  // ============================================
  // AUDIT LOGGING
  // ============================================

  async logAudit(input) {
    const {
      user_id = null,
      user_email = null,
      action,
      resource,
      resource_id = null,
      old_values = null,
      new_values = null,
      ip_address = null,
      user_agent = null,
      request_id = null,
    } = input;

    await this.pool.query(
      `INSERT INTO audit_log (
         user_id, user_email, action, resource, resource_id,
         old_values, new_values, ip_address, user_agent, request_id
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        user_id,
        user_email,
        action,
        resource,
        resource_id,
        old_values ? JSON.stringify(old_values) : null,
        new_values ? JSON.stringify(new_values) : null,
        ip_address,
        user_agent,
        request_id,
      ]
    );
  }

  async getAuditLog(filters = {}) {
    const { user_id, resource, action, start_date, end_date, limit = 100, offset = 0 } = filters;

    let sql = `
      SELECT al.*, u.email as user_email_lookup
      FROM audit_log al
      LEFT JOIN users u ON al.user_id = u.id
      WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (user_id) {
      sql += ` AND al.user_id = $${p++}`;
      params.push(user_id);
    }
    if (resource) {
      sql += ` AND al.resource = $${p++}`;
      params.push(resource);
    }
    if (action) {
      sql += ` AND al.action = $${p++}`;
      params.push(action);
    }
    if (start_date) {
      sql += ` AND al.created_at >= $${p++}`;
      params.push(start_date);
    }
    if (end_date) {
      sql += ` AND al.created_at <= $${p++}`;
      params.push(end_date);
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${p++} OFFSET $${p++}`;
    params.push(limit, offset);

    const result = await this.pool.query(sql, params);
    return result.rows;
  }
}

module.exports = AuthService;


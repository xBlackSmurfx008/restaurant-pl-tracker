/**
 * Auth Routes
 * Authentication, user management, and audit logging
 */
const express = require('express');
const router = express.Router();
const db = require('../db');
const AuthService = require('../services/AuthService');
const { asyncHandler, NotFoundError, UnauthorizedError, ForbiddenError } = require('../utils/errors');
const { validateBody, validateId, validateQuery } = require('../middleware');
const {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  updateUserSchema,
  userQuerySchema,
  auditLogQuerySchema,
} = require('../schemas/auth.schema');

// Instantiate service
const authService = new AuthService(db.pool);

// ============================================
// AUTH MIDDLEWARE
// ============================================

/**
 * Authenticate request via Bearer token
 */
const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new UnauthorizedError('Authentication required');
  }

  const token = authHeader.substring(7);
  const user = await authService.validateToken(token);

  if (!user) {
    throw new UnauthorizedError('Invalid or expired token');
  }

  req.user = user;
  next();
});

/**
 * Require specific permission
 */
const requirePermission = (resource, action) => {
  return asyncHandler(async (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const hasPermission = await authService.checkPermission(req.user.role, resource, action);
    if (!hasPermission) {
      throw new ForbiddenError(`Permission denied: ${resource}:${action}`);
    }

    next();
  });
};

/**
 * Require one of specified roles
 */
const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError(`Role required: ${roles.join(' or ')}`);
    }

    next();
  };
};

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * POST /bootstrap - Create initial admin (only works if no users exist)
 */
router.post(
  '/bootstrap',
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    // Check if any users exist
    const existing = await db.promisify.get('SELECT COUNT(*) as count FROM users');
    if (parseInt(existing.count) > 0) {
      throw new Error('Bootstrap not allowed - users already exist');
    }

    // Force admin role for bootstrap
    const user = await authService.createUser({
      ...req.body,
      role: 'admin',
    });

    res.status(201).json(user);
  })
);

/**
 * POST /setup-demo - Setup demo admin account (for MVP/demo purposes)
 * Creates or resets admin account with simple credentials
 */
router.post(
  '/setup-demo',
  asyncHandler(async (req, res) => {
    const { username = 'admin', password = '1234' } = req.body;
    
    // Check if demo admin exists
    const existing = await db.promisify.get('SELECT id FROM users WHERE email = $1', [username.toLowerCase()]);
    
    if (existing) {
      // Update existing user's password
      const newHash = authService.hashPassword(password);
      await db.promisify.run(
        'UPDATE users SET password_hash = $1, is_active = true, locked_until = NULL, failed_login_attempts = 0 WHERE id = $2',
        [newHash, existing.id]
      );
      res.json({ message: 'Demo admin password reset', username });
    } else {
      // Create new admin user
      const user = await authService.createUser({
        email: username,
        password: password,
        first_name: 'Demo',
        last_name: 'Admin',
        role: 'admin',
      });
      res.status(201).json({ message: 'Demo admin created', username, user });
    }
  })
);

/**
 * POST /login - User login
 */
router.post(
  '/login',
  validateBody(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const result = await authService.login(
      email,
      password,
      req.ip,
      req.headers['user-agent']
    );

    // Log the login
    await authService.logAudit({
      user_id: result.user.id,
      user_email: result.user.email,
      action: 'login',
      resource: 'auth',
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      request_id: req.id,
    });

    res.json(result);
  })
);

/**
 * POST /logout - User logout
 */
router.post(
  '/logout',
  authenticate,
  asyncHandler(async (req, res) => {
    const token = req.headers.authorization.substring(7);
    await authService.logout(token);

    await authService.logAudit({
      user_id: req.user.id,
      user_email: req.user.email,
      action: 'logout',
      resource: 'auth',
      ip_address: req.ip,
      request_id: req.id,
    });

    res.json({ success: true, message: 'Logged out' });
  })
);

/**
 * GET /me - Get current user
 */
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await db.promisify.get(
      `SELECT id, email, first_name, last_name, role, employee_id, is_active, last_login, created_at
       FROM users WHERE id = $1`,
      [req.user.id]
    );
    res.json(user);
  })
);

/**
 * PUT /me/password - Change password
 */
router.put(
  '/me/password',
  authenticate,
  validateBody(changePasswordSchema),
  asyncHandler(async (req, res) => {
    const { current_password, new_password } = req.body;

    const user = await db.promisify.get('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!authService.verifyPassword(current_password, user.password_hash)) {
      throw new Error('Current password is incorrect');
    }

    const newHash = authService.hashPassword(new_password);
    await db.promisify.run(
      'UPDATE users SET password_hash = $1, password_changed_at = CURRENT_TIMESTAMP WHERE id = $2',
      [newHash, req.user.id]
    );

    await authService.logAudit({
      user_id: req.user.id,
      user_email: req.user.email,
      action: 'password_change',
      resource: 'users',
      resource_id: req.user.id,
      ip_address: req.ip,
      request_id: req.id,
    });

    res.json({ success: true, message: 'Password changed' });
  })
);

// ============================================
// ADMIN ROUTES - User Management
// ============================================

/**
 * GET /users - List users (admin only)
 */
router.get(
  '/users',
  authenticate,
  requireRole('admin'),
  validateQuery(userQuerySchema),
  asyncHandler(async (req, res) => {
    const { role, is_active } = req.query;

    let sql = `
      SELECT id, email, first_name, last_name, role, employee_id, is_active, last_login, created_at
      FROM users WHERE 1=1
    `;
    const params = [];
    let p = 1;

    if (role) {
      sql += ` AND role = $${p++}`;
      params.push(role);
    }
    if (is_active !== undefined) {
      sql += ` AND is_active = $${p++}`;
      params.push(is_active);
    }

    sql += ' ORDER BY last_name, first_name';

    const users = await db.promisify.all(sql, params);
    res.json(users);
  })
);

/**
 * POST /users - Create user (admin only)
 */
router.post(
  '/users',
  authenticate,
  requireRole('admin'),
  validateBody(registerSchema),
  asyncHandler(async (req, res) => {
    const user = await authService.createUser(req.body);

    await authService.logAudit({
      user_id: req.user.id,
      user_email: req.user.email,
      action: 'create',
      resource: 'users',
      resource_id: user.id,
      new_values: { email: user.email, role: user.role },
      ip_address: req.ip,
      request_id: req.id,
    });

    res.status(201).json(user);
  })
);

/**
 * PUT /users/:id - Update user (admin only)
 */
router.put(
  '/users/:id',
  authenticate,
  requireRole('admin'),
  validateId,
  validateBody(updateUserSchema),
  asyncHandler(async (req, res) => {
    const oldUser = await db.promisify.get('SELECT * FROM users WHERE id = $1', [req.params.id]);
    if (!oldUser) {
      throw new NotFoundError('User');
    }

    const { first_name, last_name, role, employee_id, is_active } = req.body;

    await db.promisify.run(
      `UPDATE users SET
         first_name = COALESCE($1, first_name),
         last_name = COALESCE($2, last_name),
         role = COALESCE($3, role),
         employee_id = $4,
         is_active = COALESCE($5, is_active),
         updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [first_name, last_name, role, employee_id, is_active, req.params.id]
    );

    const user = await db.promisify.get(
      `SELECT id, email, first_name, last_name, role, employee_id, is_active, created_at
       FROM users WHERE id = $1`,
      [req.params.id]
    );

    await authService.logAudit({
      user_id: req.user.id,
      user_email: req.user.email,
      action: 'update',
      resource: 'users',
      resource_id: user.id,
      old_values: { role: oldUser.role, is_active: oldUser.is_active },
      new_values: { role: user.role, is_active: user.is_active },
      ip_address: req.ip,
      request_id: req.id,
    });

    res.json(user);
  })
);

/**
 * DELETE /users/:id - Deactivate user (admin only)
 */
router.delete(
  '/users/:id',
  authenticate,
  requireRole('admin'),
  validateId,
  asyncHandler(async (req, res) => {
    if (parseInt(req.params.id) === req.user.id) {
      throw new Error('Cannot deactivate your own account');
    }

    await db.promisify.run(
      'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [req.params.id]
    );

    await authService.logAudit({
      user_id: req.user.id,
      user_email: req.user.email,
      action: 'deactivate',
      resource: 'users',
      resource_id: parseInt(req.params.id),
      ip_address: req.ip,
      request_id: req.id,
    });

    res.json({ success: true, message: 'User deactivated' });
  })
);

// ============================================
// AUDIT LOG ROUTES
// ============================================

/**
 * GET /audit-log - Get audit log (admin/accountant)
 */
router.get(
  '/audit-log',
  authenticate,
  requireRole('admin', 'accountant'),
  validateQuery(auditLogQuerySchema),
  asyncHandler(async (req, res) => {
    const logs = await authService.getAuditLog(req.query);
    res.json(logs);
  })
);

// ============================================
// PERMISSIONS ROUTES
// ============================================

/**
 * GET /permissions - Get permissions for current user's role
 */
router.get(
  '/permissions',
  authenticate,
  asyncHandler(async (req, res) => {
    const permissions = await authService.getPermissionsForRole(req.user.role);
    res.json({
      role: req.user.role,
      permissions,
    });
  })
);

/**
 * GET /permissions/:role - Get permissions for specific role (admin)
 */
router.get(
  '/permissions/:role',
  authenticate,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const permissions = await authService.getPermissionsForRole(req.params.role);
    res.json({
      role: req.params.role,
      permissions,
    });
  })
);

// Export router, service, and middleware
module.exports = router;
module.exports.authService = authService;
module.exports.authenticate = authenticate;
module.exports.requirePermission = requirePermission;
module.exports.requireRole = requireRole;


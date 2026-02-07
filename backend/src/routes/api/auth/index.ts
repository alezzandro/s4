import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import jwt, { SignOptions } from 'jsonwebtoken';

import {
  getAuthMode,
  isAuthEnabled,
  validateCredentials,
  getJwtSecret,
  getJwtExpirationSeconds,
  getAuthCookieOptions,
} from '../../../utils/authConfig';
import { logAccess } from '../../../utils/logAccess';
import { generateSseTicket } from '../../../utils/sseTickets';
import { checkRateLimit, getRateLimitResetTime } from '../../../utils/rateLimit';
import { HttpStatus } from '../../../utils/httpStatus';
import { auditLogExtended, AuditEventType } from '../../../utils/auditLog';
import { User } from '../../../plugins/auth';

// Request body types
interface LoginBody {
  username: string;
  password: string;
}

export default async (fastify: FastifyInstance): Promise<void> => {
  /**
   * GET /api/auth/info
   * Returns authentication mode and whether auth is required
   * This endpoint is always public
   */
  fastify.get('/info', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);

    const authMode = getAuthMode();
    const authRequired = isAuthEnabled();

    reply.send({
      authMode,
      authRequired,
    });
  });

  /**
   * POST /api/auth/login
   * Authenticate user with username and password
   * Returns JWT token on success
   * This endpoint is always public but rate-limited
   */
  fastify.post('/login', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);

    // Check if auth is enabled
    if (!isAuthEnabled()) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: 'Bad Request',
        message: 'Authentication is not enabled',
      });
    }

    // Rate limiting (5 attempts per minute)
    const clientIp = req.ip || 'unknown';
    const rateLimitKey = `login:${clientIp}`;
    const RATE_LIMIT_MAX = 5;
    const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

    if (checkRateLimit(rateLimitKey, RATE_LIMIT_MAX, RATE_LIMIT_WINDOW_MS)) {
      const retryAfter = getRateLimitResetTime(rateLimitKey);
      req.log.warn({ clientIp, retryAfter }, 'Login rate limit exceeded');
      return reply.code(HttpStatus.TOO_MANY_REQUESTS).send({
        error: 'RateLimitExceeded',
        message: `Too many login attempts. Maximum ${RATE_LIMIT_MAX} per minute.`,
        retryAfter,
      });
    }

    // Parse request body
    const body = req.body as LoginBody;
    if (!body || !body.username || !body.password) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: 'Bad Request',
        message: 'Username and password are required',
      });
    }

    const { username, password } = body;

    // Validate credentials using timing-safe comparison
    if (!validateCredentials(username, password)) {
      req.log.info(`Failed login attempt for username: ${username}`);

      // Audit log: login failure
      const failedUser: User = {
        id: 'unknown',
        username: username,
        roles: [],
        allowedLocations: [],
      };
      auditLogExtended({
        user: failedUser,
        eventType: AuditEventType.AUTH_LOGIN_FAILURE,
        action: 'login',
        resource: 'auth:login',
        status: 'failure',
        details: 'Invalid credentials',
        clientIp: clientIp,
      });

      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: 'Unauthorized',
        message: 'Invalid username or password',
      });
    }

    // Create JWT token
    const userPayload = {
      id: 'admin',
      username: username,
      roles: ['admin'],
    };

    const signOptions: SignOptions = {
      expiresIn: getJwtExpirationSeconds(),
    };

    const token = jwt.sign(userPayload, getJwtSecret(), signOptions);

    req.log.info(`Successful login for username: ${username}`);

    // Audit log: login success
    const successUser: User = {
      id: userPayload.id,
      username: userPayload.username,
      roles: userPayload.roles,
      allowedLocations: [],
    };
    auditLogExtended({
      user: successUser,
      eventType: AuditEventType.AUTH_LOGIN_SUCCESS,
      action: 'login',
      resource: 'auth:login',
      status: 'success',
      clientIp: clientIp,
    });

    // Set HttpOnly cookie with JWT token
    reply.setCookie('s4_auth_token', token, getAuthCookieOptions());

    reply.send({
      token, // Keep for backward compatibility with sessionStorage clients
      user: {
        id: userPayload.id,
        username: userPayload.username,
        roles: userPayload.roles,
      },
      expiresIn: getJwtExpirationSeconds(),
    });
  });

  /**
   * POST /api/auth/logout
   * Logout endpoint (client-side token deletion)
   * Just acknowledges the logout request
   */
  fastify.post('/logout', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);

    // Audit log: logout (if user was authenticated)
    if (req.user) {
      auditLogExtended({
        user: req.user,
        eventType: AuditEventType.AUTH_LOGOUT,
        action: 'logout',
        resource: 'auth:logout',
        status: 'success',
        clientIp: req.ip || 'unknown',
      });
    }

    // Clear the auth cookie
    reply.clearCookie('s4_auth_token', { path: '/' });

    reply.send({
      message: 'Logged out successfully',
    });
  });

  /**
   * GET /api/auth/me
   * Returns information about the authenticated user
   * Requires authentication
   */
  fastify.get('/me', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);

    // This endpoint requires authentication
    // The auth hook in app.ts will have already verified the token
    // and attached req.user

    if (!req.user) {
      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    reply.send({
      user: {
        id: req.user.id,
        username: req.user.username,
        roles: req.user.roles,
      },
    });
  });

  /**
   * POST /api/auth/sse-ticket
   * Generate a one-time ticket for SSE (Server-Sent Events) authentication
   *
   * Requires authentication (cookie or Authorization header)
   * Returns a short-lived, single-use ticket for establishing SSE connections
   *
   * Request body:
   * {
   *   "resource": "transfer-123" or "encodedKey",
   *   "resourceType": "transfer" or "upload"
   * }
   *
   * Response:
   * {
   *   "ticket": "base64url-encoded-random-bytes",
   *   "sseUrl": "/transfer/progress/:jobId?ticket=..." (no /api prefix),
   *   "expiresAt": 1234567890000,
   *   "expiresIn": 60
   * }
   */
  interface SseTicketRequest {
    resource: string;
    resourceType: 'transfer' | 'upload';
  }

  fastify.post<{ Body: SseTicketRequest }>('/sse-ticket', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);

    // This endpoint requires authentication (enforced by global hook)
    if (!req.user) {
      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: 'Unauthorized',
        message: 'Authentication required',
      });
    }

    // Rate limiting for ticket generation (prevents abuse)
    const clientIp = req.ip || 'unknown';
    const rateLimitKey = `sse-ticket:${clientIp}`;
    const RATE_LIMIT_TICKETS = 20; // requests per minute
    const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute

    if (checkRateLimit(rateLimitKey, RATE_LIMIT_TICKETS, RATE_LIMIT_WINDOW_MS)) {
      const retryAfter = getRateLimitResetTime(rateLimitKey);
      return reply.code(HttpStatus.TOO_MANY_REQUESTS).send({
        error: 'RateLimitExceeded',
        message: `Too many ticket requests. Maximum ${RATE_LIMIT_TICKETS} per minute.`,
        retryAfter,
      });
    }

    // Parse and validate request body
    const body = req.body as SseTicketRequest;
    if (!body || !body.resource || !body.resourceType) {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: 'BadRequest',
        message: 'Resource and resourceType are required',
      });
    }

    const { resource, resourceType } = body;

    // Validate resourceType
    if (resourceType !== 'transfer' && resourceType !== 'upload') {
      return reply.code(HttpStatus.BAD_REQUEST).send({
        error: 'BadRequest',
        message: "Invalid resourceType. Must be 'transfer' or 'upload'",
      });
    }

    // Generate ticket
    try {
      const { ticket, expiresAt } = generateSseTicket(
        req.user.id,
        req.user.username,
        req.user.roles,
        resource,
        resourceType,
      );

      // Construct SSE URL with ticket (without /api prefix - frontend will add it)
      const sseUrl =
        resourceType === 'transfer'
          ? `/transfer/progress/${resource}?ticket=${ticket}`
          : `/objects/upload-progress/${resource}?ticket=${ticket}`;

      const expiresIn = Math.floor((expiresAt - Date.now()) / 1000);

      req.log.info(`Generated SSE ticket for user ${req.user.username}, resource ${resource} (${resourceType})`);

      return reply.code(HttpStatus.OK).send({
        ticket,
        sseUrl,
        expiresAt,
        expiresIn,
      });
    } catch (error: any) {
      req.log.error(error, 'Failed to generate SSE ticket');
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: 'InternalServerError',
        message: 'Failed to generate ticket',
      });
    }
  });
};

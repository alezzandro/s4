import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import authRoutes from '../../../../routes/api/auth';
import { User } from '../../../../plugins/auth';

// Mock authConfig
jest.mock('../../../../utils/authConfig', () => ({
  getAuthMode: jest.fn(),
  isAuthEnabled: jest.fn(),
  validateCredentials: jest.fn(),
  getJwtSecret: jest.fn().mockReturnValue('test-secret-key-for-jwt-signing'),
  getJwtExpirationSeconds: jest.fn().mockReturnValue(28800),
  getAuthCookieOptions: jest.fn().mockReturnValue({
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 28800,
    signed: true,
  }),
}));

// Mock logAccess
jest.mock('../../../../utils/logAccess', () => ({
  logAccess: jest.fn(),
}));

// Mock sseTickets
jest.mock('../../../../utils/sseTickets', () => ({
  generateSseTicket: jest.fn(),
}));

// Mock rateLimit
jest.mock('../../../../utils/rateLimit', () => ({
  checkRateLimit: jest.fn(),
  getRateLimitResetTime: jest.fn().mockReturnValue(30),
}));

// Mock auditLog
jest.mock('../../../../utils/auditLog', () => ({
  auditLogExtended: jest.fn(),
  AuditEventType: {
    AUTH_LOGIN_SUCCESS: 'auth.login.success',
    AUTH_LOGIN_FAILURE: 'auth.login.failure',
    AUTH_LOGOUT: 'auth.logout',
  },
}));

import { getAuthMode, isAuthEnabled, validateCredentials } from '../../../../utils/authConfig';
import { generateSseTicket } from '../../../../utils/sseTickets';
import { checkRateLimit, getRateLimitResetTime } from '../../../../utils/rateLimit';
import { auditLogExtended } from '../../../../utils/auditLog';

describe('Auth Routes', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default mocks
    (getAuthMode as jest.Mock).mockReturnValue('simple');
    (isAuthEnabled as jest.Mock).mockReturnValue(true);
    (validateCredentials as jest.Mock).mockReturnValue(false);
    (checkRateLimit as jest.Mock).mockReturnValue(false);

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Fastify = require('fastify');
    fastify = Fastify();

    // Register cookie plugin for auth cookie handling
    await fastify.register(cookie, {
      secret: 'test-cookie-secret',
    });

    await fastify.register(authRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /info', () => {
    it('should return auth mode and authRequired status when auth is enabled', async () => {
      (getAuthMode as jest.Mock).mockReturnValue('simple');
      (isAuthEnabled as jest.Mock).mockReturnValue(true);

      const response = await fastify.inject({
        method: 'GET',
        url: '/info',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.authMode).toBe('simple');
      expect(payload.authRequired).toBe(true);
    });

    it('should return auth mode none when auth is disabled', async () => {
      (getAuthMode as jest.Mock).mockReturnValue('none');
      (isAuthEnabled as jest.Mock).mockReturnValue(false);

      const response = await fastify.inject({
        method: 'GET',
        url: '/info',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.authMode).toBe('none');
      expect(payload.authRequired).toBe(false);
    });
  });

  describe('POST /login', () => {
    it('should return 400 when auth is not enabled', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin', password: 'secret' },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Bad Request');
      expect(payload.message).toBe('Authentication is not enabled');
    });

    it('should return 429 when rate limit is exceeded', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(true);
      (getRateLimitResetTime as jest.Mock).mockReturnValue(45);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin', password: 'secret' },
      });

      expect(response.statusCode).toBe(429);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('RateLimitExceeded');
      expect(payload.retryAfter).toBe(45);
    });

    it('should return 400 when username is missing', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { password: 'secret' },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Bad Request');
      expect(payload.message).toBe('Username and password are required');
    });

    it('should return 400 when password is missing', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin' },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Bad Request');
      expect(payload.message).toBe('Username and password are required');
    });

    it('should return 400 when body is empty', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Bad Request');
      expect(payload.message).toBe('Username and password are required');
    });

    it('should return 401 when credentials are invalid', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (validateCredentials as jest.Mock).mockReturnValue(false);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin', password: 'wrongpassword' },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Unauthorized');
      expect(payload.message).toBe('Invalid username or password');
      expect(auditLogExtended).toHaveBeenCalled();
    });

    it('should return JWT token and user info on successful login', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (validateCredentials as jest.Mock).mockReturnValue(true);

      const response = await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin', password: 'correctpassword' },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.token).toBeDefined();
      expect(payload.user).toBeDefined();
      expect(payload.user.username).toBe('admin');
      expect(payload.user.id).toBe('admin');
      expect(payload.user.roles).toContain('admin');
      expect(payload.expiresIn).toBe(28800);

      // Check cookie was set
      const cookies = response.cookies;
      const authCookie = cookies.find((c: { name: string }) => c.name === 's4_auth_token');
      expect(authCookie).toBeDefined();
    });

    it('should log audit event on successful login', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (validateCredentials as jest.Mock).mockReturnValue(true);

      await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin', password: 'correctpassword' },
      });

      expect(auditLogExtended).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'auth.login.success',
          action: 'login',
          status: 'success',
        }),
      );
    });

    it('should log audit event on failed login', async () => {
      (isAuthEnabled as jest.Mock).mockReturnValue(true);
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (validateCredentials as jest.Mock).mockReturnValue(false);

      await fastify.inject({
        method: 'POST',
        url: '/login',
        payload: { username: 'admin', password: 'wrongpassword' },
      });

      expect(auditLogExtended).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'auth.login.failure',
          action: 'login',
          status: 'failure',
        }),
      );
    });
  });

  describe('POST /logout', () => {
    it('should return success and clear cookie', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('Logged out successfully');
    });

    it('should log audit event when user is authenticated', async () => {
      // First create an instance with user attached
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Fastify = require('fastify');
      const testFastify = Fastify();

      await testFastify.register(cookie, {
        secret: 'test-cookie-secret',
      });

      // Add hook to attach user
      testFastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
        request.user = {
          id: 'admin',
          username: 'admin',
          roles: ['admin'],
          allowedLocations: [],
        } as User;
      });

      await testFastify.register(authRoutes);

      const response = await testFastify.inject({
        method: 'POST',
        url: '/logout',
      });

      expect(response.statusCode).toBe(200);
      expect(auditLogExtended).toHaveBeenCalledWith(
        expect.objectContaining({
          eventType: 'auth.logout',
          action: 'logout',
          status: 'success',
        }),
      );

      await testFastify.close();
    });
  });

  describe('GET /me', () => {
    it('should return 401 when user is not authenticated', async () => {
      const response = await fastify.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Unauthorized');
      expect(payload.message).toBe('Authentication required');
    });

    it('should return user info when authenticated', async () => {
      // Create instance with user attached
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Fastify = require('fastify');
      const testFastify = Fastify();

      await testFastify.register(cookie, {
        secret: 'test-cookie-secret',
      });

      testFastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
        request.user = {
          id: 'admin',
          username: 'testuser',
          roles: ['admin'],
          allowedLocations: [],
        } as User;
      });

      await testFastify.register(authRoutes);

      const response = await testFastify.inject({
        method: 'GET',
        url: '/me',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.user).toBeDefined();
      expect(payload.user.id).toBe('admin');
      expect(payload.user.username).toBe('testuser');
      expect(payload.user.roles).toContain('admin');

      await testFastify.close();
    });
  });

  describe('POST /sse-ticket', () => {
    let authenticatedFastify: FastifyInstance;

    beforeEach(async () => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Fastify = require('fastify');
      authenticatedFastify = Fastify();

      await authenticatedFastify.register(cookie, {
        secret: 'test-cookie-secret',
      });

      authenticatedFastify.addHook('onRequest', async (request: FastifyRequest, _reply: FastifyReply) => {
        request.user = {
          id: 'admin',
          username: 'testuser',
          roles: ['admin'],
          allowedLocations: [],
        } as User;
      });

      await authenticatedFastify.register(authRoutes);
    });

    afterEach(async () => {
      await authenticatedFastify.close();
    });

    it('should return 401 when user is not authenticated', async () => {
      const response = await fastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-123', resourceType: 'transfer' },
      });

      expect(response.statusCode).toBe(401);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('Unauthorized');
    });

    it('should return 429 when rate limit is exceeded', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(true);
      (getRateLimitResetTime as jest.Mock).mockReturnValue(30);

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-123', resourceType: 'transfer' },
      });

      expect(response.statusCode).toBe(429);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('RateLimitExceeded');
    });

    it('should return 400 when resource is missing', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resourceType: 'transfer' },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('BadRequest');
      expect(payload.message).toBe('Resource and resourceType are required');
    });

    it('should return 400 when resourceType is missing', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-123' },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('BadRequest');
    });

    it('should return 400 when resourceType is invalid', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-123', resourceType: 'invalid' },
      });

      expect(response.statusCode).toBe(400);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('BadRequest');
      expect(payload.message).toContain('Invalid resourceType');
    });

    it('should generate ticket for transfer resourceType', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (generateSseTicket as jest.Mock).mockReturnValue({
        ticket: 'test-ticket-12345',
        expiresAt: Date.now() + 60000,
      });

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-123', resourceType: 'transfer' },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.ticket).toBe('test-ticket-12345');
      expect(payload.sseUrl).toContain('/transfer/progress/job-123');
      expect(payload.sseUrl).toContain('ticket=test-ticket-12345');
      expect(payload.expiresAt).toBeDefined();
      expect(payload.expiresIn).toBeDefined();
    });

    it('should generate ticket for upload resourceType', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (generateSseTicket as jest.Mock).mockReturnValue({
        ticket: 'upload-ticket-abc',
        expiresAt: Date.now() + 60000,
      });

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'encoded-key', resourceType: 'upload' },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.ticket).toBe('upload-ticket-abc');
      expect(payload.sseUrl).toContain('/objects/upload-progress/encoded-key');
      expect(payload.sseUrl).toContain('ticket=upload-ticket-abc');
    });

    it('should call generateSseTicket with correct parameters', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (generateSseTicket as jest.Mock).mockReturnValue({
        ticket: 'test-ticket',
        expiresAt: Date.now() + 60000,
      });

      await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-456', resourceType: 'transfer' },
      });

      expect(generateSseTicket).toHaveBeenCalledWith(
        'admin', // userId
        'testuser', // username
        ['admin'], // roles
        'job-456', // resource
        'transfer', // resourceType
      );
    });

    it('should return 500 when ticket generation fails', async () => {
      (checkRateLimit as jest.Mock).mockReturnValue(false);
      (generateSseTicket as jest.Mock).mockImplementation(() => {
        throw new Error('Ticket generation failed');
      });

      const response = await authenticatedFastify.inject({
        method: 'POST',
        url: '/sse-ticket',
        payload: { resource: 'job-123', resourceType: 'transfer' },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('InternalServerError');
      expect(payload.message).toBe('Failed to generate ticket');
    });
  });
});

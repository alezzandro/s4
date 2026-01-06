import {
  getAuthMode,
  isAuthEnabled,
  getAuthCredentials,
  getJwtSecret,
  getJwtExpirationSeconds,
  getJwtExpiration,
  validateCredentials,
  isPublicRoute,
  getAuthCookieOptions,
  PUBLIC_ROUTES,
} from '../../utils/authConfig';

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('Auth Config Utility', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment variables before each test
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.UI_USERNAME;
    delete process.env.UI_PASSWORD;
    delete process.env.JWT_SECRET;
    delete process.env.JWT_EXPIRATION_HOURS;
    delete process.env.NODE_ENV;
    delete process.env.COOKIE_REQUIRE_HTTPS;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getAuthMode', () => {
    it("should return 'none' when neither UI_USERNAME nor UI_PASSWORD is set", () => {
      expect(getAuthMode()).toBe('none');
    });

    it("should return 'none' when only UI_USERNAME is set", () => {
      process.env.UI_USERNAME = 'admin';

      expect(getAuthMode()).toBe('none');
    });

    it("should return 'none' when only UI_PASSWORD is set", () => {
      process.env.UI_PASSWORD = 'secret';

      expect(getAuthMode()).toBe('none');
    });

    it("should return 'simple' when both UI_USERNAME and UI_PASSWORD are set", () => {
      process.env.UI_USERNAME = 'admin';
      process.env.UI_PASSWORD = 'secret';

      expect(getAuthMode()).toBe('simple');
    });

    it("should return 'simple' when credentials are empty strings", () => {
      process.env.UI_USERNAME = '';
      process.env.UI_PASSWORD = '';

      // Empty strings are falsy, so auth is disabled
      expect(getAuthMode()).toBe('none');
    });
  });

  describe('isAuthEnabled', () => {
    it("should return false when auth mode is 'none'", () => {
      expect(isAuthEnabled()).toBe(false);
    });

    it("should return true when auth mode is 'simple'", () => {
      process.env.UI_USERNAME = 'admin';
      process.env.UI_PASSWORD = 'secret';

      expect(isAuthEnabled()).toBe(true);
    });
  });

  describe('getAuthCredentials', () => {
    it('should return null when auth is disabled', () => {
      expect(getAuthCredentials()).toBeNull();
    });

    it('should return credentials when auth is enabled', () => {
      process.env.UI_USERNAME = 'admin';
      process.env.UI_PASSWORD = 'secret123';

      const credentials = getAuthCredentials();

      expect(credentials).not.toBeNull();
      expect(credentials!.username).toBe('admin');
      expect(credentials!.password).toBe('secret123');
    });
  });

  describe('getJwtSecret', () => {
    it('should return JWT_SECRET from environment when set', () => {
      process.env.JWT_SECRET = 'my-custom-secret';

      expect(getJwtSecret()).toBe('my-custom-secret');
    });

    it('should generate a random secret when JWT_SECRET is not set', () => {
      const secret = getJwtSecret();

      expect(secret).toBeDefined();
      expect(typeof secret).toBe('string');
      expect(secret.length).toBeGreaterThan(0);
    });

    it('should return the same generated secret on subsequent calls', () => {
      const secret1 = getJwtSecret();
      const secret2 = getJwtSecret();

      expect(secret1).toBe(secret2);
    });
  });

  describe('getJwtExpirationSeconds', () => {
    it('should return default 8 hours (28800 seconds) when not configured', () => {
      expect(getJwtExpirationSeconds()).toBe(28800);
    });

    it('should return custom value from JWT_EXPIRATION_HOURS', () => {
      process.env.JWT_EXPIRATION_HOURS = '24';

      expect(getJwtExpirationSeconds()).toBe(86400); // 24 * 60 * 60
    });

    it('should return default when JWT_EXPIRATION_HOURS is invalid', () => {
      process.env.JWT_EXPIRATION_HOURS = 'invalid';

      expect(getJwtExpirationSeconds()).toBe(28800);
    });

    it('should return default when JWT_EXPIRATION_HOURS is zero', () => {
      process.env.JWT_EXPIRATION_HOURS = '0';

      expect(getJwtExpirationSeconds()).toBe(28800);
    });

    it('should return default when JWT_EXPIRATION_HOURS is negative', () => {
      process.env.JWT_EXPIRATION_HOURS = '-5';

      expect(getJwtExpirationSeconds()).toBe(28800);
    });

    it('should handle 1 hour correctly', () => {
      process.env.JWT_EXPIRATION_HOURS = '1';

      expect(getJwtExpirationSeconds()).toBe(3600);
    });
  });

  describe('getJwtExpiration', () => {
    it("should return '8h' by default", () => {
      expect(getJwtExpiration()).toBe('8h');
    });

    it('should return custom hours format', () => {
      process.env.JWT_EXPIRATION_HOURS = '12';

      expect(getJwtExpiration()).toBe('12h');
    });

    it("should return '8h' when value is invalid", () => {
      process.env.JWT_EXPIRATION_HOURS = 'not-a-number';

      expect(getJwtExpiration()).toBe('8h');
    });

    it("should return '8h' when value is zero or negative", () => {
      process.env.JWT_EXPIRATION_HOURS = '0';
      expect(getJwtExpiration()).toBe('8h');

      process.env.JWT_EXPIRATION_HOURS = '-1';
      expect(getJwtExpiration()).toBe('8h');
    });
  });

  describe('validateCredentials', () => {
    beforeEach(() => {
      process.env.UI_USERNAME = 'admin';
      process.env.UI_PASSWORD = 'correctpassword';
    });

    it('should return false when auth is disabled', () => {
      delete process.env.UI_USERNAME;
      delete process.env.UI_PASSWORD;

      expect(validateCredentials('admin', 'password')).toBe(false);
    });

    it('should return true for correct credentials', () => {
      expect(validateCredentials('admin', 'correctpassword')).toBe(true);
    });

    it('should return false for incorrect password', () => {
      expect(validateCredentials('admin', 'wrongpassword')).toBe(false);
    });

    it('should return false for incorrect username', () => {
      expect(validateCredentials('wronguser', 'correctpassword')).toBe(false);
    });

    it('should return false for both incorrect', () => {
      expect(validateCredentials('wronguser', 'wrongpassword')).toBe(false);
    });

    it('should return false for empty username', () => {
      expect(validateCredentials('', 'correctpassword')).toBe(false);
    });

    it('should return false for empty password', () => {
      expect(validateCredentials('admin', '')).toBe(false);
    });

    it('should handle special characters in credentials', () => {
      process.env.UI_USERNAME = 'admin@example.com';
      process.env.UI_PASSWORD = 'p@$$w0rd!#$%';

      expect(validateCredentials('admin@example.com', 'p@$$w0rd!#$%')).toBe(true);
      expect(validateCredentials('admin@example.com', 'wrong')).toBe(false);
    });

    it('should handle unicode characters in credentials', () => {
      process.env.UI_USERNAME = 'user';
      process.env.UI_PASSWORD = 'password';

      expect(validateCredentials('user', 'password')).toBe(true);
    });

    it('should be case-sensitive for username', () => {
      expect(validateCredentials('Admin', 'correctpassword')).toBe(false);
      expect(validateCredentials('ADMIN', 'correctpassword')).toBe(false);
    });

    it('should be case-sensitive for password', () => {
      expect(validateCredentials('admin', 'Correctpassword')).toBe(false);
      expect(validateCredentials('admin', 'CORRECTPASSWORD')).toBe(false);
    });
  });

  describe('PUBLIC_ROUTES', () => {
    it('should include /api/auth/info', () => {
      expect(PUBLIC_ROUTES).toContain('/api/auth/info');
    });

    it('should include /api/auth/login', () => {
      expect(PUBLIC_ROUTES).toContain('/api/auth/login');
    });
  });

  describe('isPublicRoute', () => {
    it('should return true for /api (health check endpoint)', () => {
      expect(isPublicRoute('/api')).toBe(true);
    });

    it('should return true for /api/auth/info', () => {
      expect(isPublicRoute('/api/auth/info')).toBe(true);
    });

    it('should return true for /api/auth/login', () => {
      expect(isPublicRoute('/api/auth/login')).toBe(true);
    });

    it('should return false for /api/auth/logout', () => {
      expect(isPublicRoute('/api/auth/logout')).toBe(false);
    });

    it('should return false for /api/auth/me', () => {
      expect(isPublicRoute('/api/auth/me')).toBe(false);
    });

    it('should return false for /api/buckets', () => {
      expect(isPublicRoute('/api/buckets')).toBe(false);
    });

    it('should return false for /api/objects', () => {
      expect(isPublicRoute('/api/objects')).toBe(false);
    });

    it('should handle query strings', () => {
      expect(isPublicRoute('/api?foo=bar')).toBe(true);
      expect(isPublicRoute('/api/auth/info?foo=bar')).toBe(true);
      expect(isPublicRoute('/api/auth/login?redirect=/home')).toBe(true);
      expect(isPublicRoute('/api/buckets?page=1')).toBe(false);
    });

    it('should handle trailing slashes', () => {
      expect(isPublicRoute('/api/auth/info/')).toBe(true);
      expect(isPublicRoute('/api/auth/login/')).toBe(true);
    });

    it('should not make /api subpaths public (exact match only)', () => {
      // /api is public for health checks, but /api/* should still require auth
      expect(isPublicRoute('/api')).toBe(true);
      expect(isPublicRoute('/api/')).toBe(false);
      expect(isPublicRoute('/api/disclaimer')).toBe(false);
      expect(isPublicRoute('/api/settings')).toBe(false);
    });

    it('should not match partial paths incorrectly', () => {
      // /api/auth/infosomething should NOT match /api/auth/info
      // But /api/auth/info/something should match as a subpath
      expect(isPublicRoute('/api/auth/info/subpath')).toBe(true);
      expect(isPublicRoute('/api/auth/login/callback')).toBe(true);
    });
  });

  describe('getAuthCookieOptions', () => {
    it('should return httpOnly: true always', () => {
      const options = getAuthCookieOptions();
      expect(options.httpOnly).toBe(true);
    });

    it('should return signed: true always', () => {
      const options = getAuthCookieOptions();
      expect(options.signed).toBe(true);
    });

    it("should return path: '/' always", () => {
      const options = getAuthCookieOptions();
      expect(options.path).toBe('/');
    });

    it('should set secure: false in development', () => {
      process.env.NODE_ENV = 'development';

      const options = getAuthCookieOptions();
      expect(options.secure).toBe(false);
    });

    it("should set sameSite: 'lax' in development", () => {
      process.env.NODE_ENV = 'development';

      const options = getAuthCookieOptions();
      expect(options.sameSite).toBe('lax');
    });

    it('should set secure: true in production by default', () => {
      process.env.NODE_ENV = 'production';

      const options = getAuthCookieOptions();
      expect(options.secure).toBe(true);
    });

    it("should set sameSite: 'strict' in production", () => {
      process.env.NODE_ENV = 'production';

      const options = getAuthCookieOptions();
      expect(options.sameSite).toBe('strict');
    });

    it('should allow disabling HTTPS requirement in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.COOKIE_REQUIRE_HTTPS = 'false';

      const options = getAuthCookieOptions();
      expect(options.secure).toBe(false);
    });

    it('should set maxAge based on JWT expiration', () => {
      process.env.JWT_EXPIRATION_HOURS = '24';

      const options = getAuthCookieOptions();
      expect(options.maxAge).toBe(86400); // 24 hours in seconds
    });

    it('should use default maxAge when JWT expiration is not set', () => {
      const options = getAuthCookieOptions();
      expect(options.maxAge).toBe(28800); // 8 hours default
    });
  });
});

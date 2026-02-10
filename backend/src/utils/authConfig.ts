import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger(undefined, '[Auth Config]');

/**
 * Authentication mode types
 * - 'none': No authentication required (default)
 * - 'simple': Basic username/password authentication with JWT tokens
 */
export type AuthMode = 'none' | 'simple';

/**
 * User interface for authenticated users
 */
export interface AuthUser {
  id: string;
  username: string;
  roles: string[];
}

// Generate a random JWT secret if not provided
// This secret persists for the lifetime of the process
let generatedJwtSecret: string | null = null;

/**
 * Get the current authentication mode
 * Returns 'simple' if both UI_USERNAME and UI_PASSWORD are set
 * Returns 'none' otherwise
 */
export function getAuthMode(): AuthMode {
  const username = process.env.UI_USERNAME;
  const password = process.env.UI_PASSWORD;

  if (username && password) {
    return 'simple';
  }

  // Warn if only one is set
  if (username && !password) {
    logger.warn('UI_USERNAME is set but UI_PASSWORD is not. Authentication is disabled.');
  }
  if (!username && password) {
    logger.warn('UI_PASSWORD is set but UI_USERNAME is not. Authentication is disabled.');
  }

  return 'none';
}

/**
 * Check if authentication is enabled
 */
export function isAuthEnabled(): boolean {
  return getAuthMode() !== 'none';
}

/**
 * Get the configured admin credentials
 * Returns null if authentication is not enabled
 */
export function getAuthCredentials(): {
  username: string;
  password: string;
} | null {
  if (!isAuthEnabled()) {
    return null;
  }

  return {
    username: process.env.UI_USERNAME!,
    password: process.env.UI_PASSWORD!,
  };
}

/**
 * Get the JWT secret for signing tokens
 * If JWT_SECRET is not set, generates a random 64-byte secret
 * The generated secret persists for the lifetime of the process
 */
export function getJwtSecret(): string {
  // Use environment variable if set
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  // Generate and cache a random secret
  if (!generatedJwtSecret) {
    generatedJwtSecret = crypto.randomBytes(64).toString('base64');
    logger.info('JWT_SECRET not set. Generated a random secret for this session.');
  }

  return generatedJwtSecret;
}

/**
 * Get JWT expiration time in seconds
 * Defaults to 8 hours (28800 seconds)
 */
export function getJwtExpirationSeconds(): number {
  const hours = parseInt(process.env.JWT_EXPIRATION_HOURS || '8', 10);
  if (isNaN(hours) || hours <= 0) {
    logger.warn(
      {
        provided: process.env.JWT_EXPIRATION_HOURS,
        default: '8 hours',
      },
      'Invalid JWT_EXPIRATION_HOURS configuration',
    );
    return 8 * 60 * 60;
  }
  return hours * 60 * 60;
}

/**
 * Get JWT expiration time as string for jwt.sign()
 * Returns format like '8h'
 */
export function getJwtExpiration(): string {
  const hours = parseInt(process.env.JWT_EXPIRATION_HOURS || '8', 10);
  if (isNaN(hours) || hours <= 0) {
    return '8h';
  }
  return `${hours}h`;
}

/**
 * Validate credentials using timing-safe comparison
 * Prevents timing attacks by ensuring comparison takes constant time
 */
export function validateCredentials(username: string, password: string): boolean {
  const credentials = getAuthCredentials();
  if (!credentials) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  const usernameBuffer = Buffer.from(username);
  const passwordBuffer = Buffer.from(password);
  const expectedUsernameBuffer = Buffer.from(credentials.username);
  const expectedPasswordBuffer = Buffer.from(credentials.password);

  // Both comparisons must succeed
  // We need to handle different length strings by padding
  const usernameMatch =
    usernameBuffer.length === expectedUsernameBuffer.length &&
    crypto.timingSafeEqual(usernameBuffer, expectedUsernameBuffer);

  const passwordMatch =
    passwordBuffer.length === expectedPasswordBuffer.length &&
    crypto.timingSafeEqual(passwordBuffer, expectedPasswordBuffer);

  return usernameMatch && passwordMatch;
}

/**
 * Routes that don't require authentication.
 * These are checked for exact match AND prefix match (e.g., /api/auth/info/subpath).
 */
export const PUBLIC_ROUTES = ['/api/auth/info', '/api/auth/login'];

/**
 * Routes that require exact match only to be public.
 * These are for health check endpoints that should not make their subpaths public.
 */
export const PUBLIC_ROUTES_EXACT = ['/api', '/api/github/repo-info'];

/**
 * Check if a URL path is a public route
 */
export function isPublicRoute(url: string): boolean {
  // Handle routes with query strings
  const path = url.split('?')[0];

  // Check exact-match-only routes (health check endpoint)
  if (PUBLIC_ROUTES_EXACT.includes(path)) {
    return true;
  }

  // Check routes that allow prefix matches (auth endpoints and their subpaths)
  return PUBLIC_ROUTES.some((route) => path === route || path.startsWith(route + '/'));
}

/**
 * Get cookie options for JWT token cookie
 *
 * Security Configuration:
 * - Development: SameSite=Lax, Secure=false (HTTP localhost)
 * - Production (HTTPS): SameSite=Strict, Secure=true (default)
 * - Production (HTTP-only): SameSite=Strict, Secure=false (set COOKIE_REQUIRE_HTTPS=false)
 *
 * Environment Variables:
 * - COOKIE_REQUIRE_HTTPS: Set to 'false' to allow cookies over HTTP in production
 *   Default: true (requires HTTPS)
 *   Use Case: Internal networks, air-gapped environments, testing
 *
 * Security Notes:
 * - HttpOnly is ALWAYS true (prevents XSS attacks)
 * - SameSite provides CSRF protection in all modes
 * - With Secure=false, tokens are vulnerable to network eavesdropping
 *   Only use in trusted network environments
 */
export function getAuthCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax' | 'strict';
  path: string;
  maxAge: number;
  signed: boolean;
} {
  const isDev = process.env.NODE_ENV === 'development';
  const maxAge = getJwtExpirationSeconds();

  // Allow disabling Secure flag for HTTP-only deployments
  // Default to requiring HTTPS in production unless explicitly disabled
  const requireHttps = process.env.COOKIE_REQUIRE_HTTPS !== 'false';

  return {
    httpOnly: true, // ALWAYS true - prevents JavaScript access (XSS protection)
    secure: isDev ? false : requireHttps, // false in dev, configurable in prod
    sameSite: (isDev ? 'lax' : 'strict') as 'lax' | 'strict',
    path: '/',
    maxAge: maxAge,
    signed: true, // Sign cookie for tamper protection
  };
}

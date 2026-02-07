import { FastifyReply, FastifyRequest } from 'fastify';
import jwt from 'jsonwebtoken';

import { isAuthEnabled, getJwtSecret, isPublicRoute } from '../utils/authConfig';
import { validateSseTicket } from '../utils/sseTickets';
import { HttpStatus } from '../utils/httpStatus';

/**
 * User interface representing an authenticated user
 */
export interface User {
  id: string;
  username: string;
  roles: string[];
  allowedLocations: string[];
}

/**
 * Check if authentication is disabled
 *
 * Authentication is disabled when:
 * 1. Neither UI_USERNAME nor UI_PASSWORD are set (no simple auth)
 * 2. AND DISABLE_AUTH is not explicitly set to 'false' (OAuth proxy mode)
 *
 * Authentication is enabled when:
 * 1. Both UI_USERNAME and UI_PASSWORD are set (simple auth mode)
 * 2. OR DISABLE_AUTH is set to 'false' (standalone JWT mode)
 */
function isAuthDisabled(): boolean {
  // If simple auth is enabled via UI_USERNAME/UI_PASSWORD, auth is NOT disabled
  if (isAuthEnabled()) {
    return false;
  }
  // Otherwise, check the DISABLE_AUTH environment variable
  // Default to disabled (true) unless explicitly set to 'false'
  return process.env.DISABLE_AUTH !== 'false';
}

// Re-export isPublicRoute for use in app.ts
export { isPublicRoute };

/**
 * Extract resource information from SSE endpoint URLs
 *
 * @param url - Request URL (may include query string)
 * @returns Object with resource identifier and type, or nulls if not an SSE endpoint
 */
interface ResourceInfo {
  resource: string | null;
  resourceType: 'transfer' | 'upload' | null;
}

function extractResourceFromPath(url: string): ResourceInfo {
  // Remove query string
  const path = url.split('?')[0];

  // Match transfer progress endpoint: /api/transfer/progress/:jobId
  const transferMatch = path.match(/\/api\/transfer\/progress\/([^/]+)/);
  if (transferMatch) {
    return {
      resource: transferMatch[1],
      resourceType: 'transfer',
    };
  }

  // Match upload progress endpoint: /api/objects/upload-progress/:encodedKey
  const uploadMatch = path.match(/\/api\/objects\/upload-progress\/([^/]+)/);
  if (uploadMatch) {
    return {
      resource: uploadMatch[1],
      resourceType: 'upload',
    };
  }

  return { resource: null, resourceType: null };
}

/**
 * Create a mock admin user for when authentication is disabled
 * This allows the app to work behind an OAuth proxy without JWT tokens
 */
function createMockUser(): User {
  return {
    id: 'proxy-user',
    username: 'proxy-user',
    roles: ['admin'],
    allowedLocations: [], // Empty array is OK since admin role bypasses location checks
  };
}

/**
 * Authenticate user from JWT token
 * Accepts token from:
 * 1. Authorization header (Bearer <token>)
 * 2. Query parameter (?token=<token>) - for browser downloads
 *
 * If DISABLE_AUTH=true, bypasses JWT validation and creates a mock admin user
 * Throws 401 if token is invalid or missing (when auth is enabled)
 */
export async function authenticateUser(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  // If user is already authenticated (by global hook), skip re-authentication
  // This prevents consuming single-use SSE tickets twice
  if (request.user) {
    request.log.debug('User already authenticated, skipping re-authentication');
    return;
  }

  // If authentication is disabled (OAuth proxy mode), create a mock admin user
  if (isAuthDisabled()) {
    request.log.debug('Authentication disabled - using mock admin user');
    request.user = createMockUser();
    return;
  }

  // Try to get token from three sources (priority order):
  // 1. Signed cookie (most secure)
  // 2. Authorization header (for API clients)
  // 3. One-time SSE ticket (for EventSource connections)
  let token: string | null = null;

  // 1. Check for signed cookie first
  const cookieToken = request.cookies.s4_auth_token;
  const signedCookieToken = request.unsignCookie(cookieToken || '');
  if (signedCookieToken.valid && signedCookieToken.value) {
    token = signedCookieToken.value;
  }

  // 2. Fallback to Authorization header
  if (!token) {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    }
  }

  // 3. Check for SSE one-time ticket
  if (!token) {
    const ticketParam = (request.query as { ticket?: string })?.ticket;

    if (ticketParam) {
      request.log.debug(
        {
          url: request.url,
          ticketPrefix: ticketParam.substring(0, 10),
        },
        'Ticket authentication attempt',
      );

      // Extract resource from URL path
      const { resource, resourceType } = extractResourceFromPath(request.url);

      request.log.debug({ resource, resourceType }, 'Extracted resource from URL');

      if (!resource || !resourceType) {
        request.log.debug('Failed to extract resource from URL');
        return reply.code(HttpStatus.BAD_REQUEST).send({
          error: 'BadRequest',
          message: 'Invalid SSE endpoint for ticket authentication',
        });
      }

      const ticketData = validateSseTicket(ticketParam, resource, resourceType);

      if (!ticketData) {
        request.log.debug({ resource }, 'Ticket validation failed');
        return reply.code(HttpStatus.UNAUTHORIZED).send({
          error: 'Unauthorized',
          message: 'Invalid or expired ticket',
        });
      }

      // Attach user from ticket data (no need to verify JWT)
      request.user = {
        id: ticketData.userId,
        username: ticketData.username,
        roles: ticketData.roles,
        allowedLocations: [], // Admin role bypasses location checks
      };

      request.log.debug({ username: ticketData.username }, 'Successfully authenticated via SSE ticket');
      return; // Successfully authenticated
    }
  }

  if (!token) {
    return reply.code(HttpStatus.UNAUTHORIZED).send({
      error: 'Unauthorized',
      message: 'Missing or invalid Authorization header',
    });
  }

  // Get JWT secret from authConfig (auto-generated if not set)
  const jwtSecret = getJwtSecret();

  try {
    const decoded = jwt.verify(token, jwtSecret) as User;

    // Validate decoded token has required fields
    if (!decoded.id || !decoded.username || !Array.isArray(decoded.roles)) {
      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: 'Unauthorized',
        message: 'Invalid token payload',
      });
    }

    // Attach user to request
    request.user = decoded;
  } catch (error: any) {
    if (error.name === 'TokenExpiredError') {
      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: 'Unauthorized',
        message: 'Token has expired',
      });
    } else if (error.name === 'JsonWebTokenError') {
      return reply.code(HttpStatus.UNAUTHORIZED).send({
        error: 'Unauthorized',
        message: 'Invalid token',
      });
    } else {
      request.log.error(error, 'Error verifying JWT token');
      return reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: 'Internal Server Error',
        message: 'Authentication error',
      });
    }
  }
}

/**
 * Authorize user access to a storage location
 * Throws 403 if user doesn't have access to the location
 */
export function authorizeLocation(user: User, locationId: string): void {
  // Admin role has access to all locations
  if (user.roles.includes('admin')) {
    return;
  }

  // Check if user has access to this specific location
  if (!user.allowedLocations || !user.allowedLocations.includes(locationId)) {
    throw new Error(`Access denied to location: ${locationId}`);
  }
}

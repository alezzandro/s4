/**
 * HTTP Status Code Constants
 *
 * Provides named constants for all HTTP status codes used in S4 backend.
 * Using constants instead of magic numbers improves:
 * - Code readability and maintainability
 * - Type safety and IDE autocomplete
 * - Consistency across the codebase
 *
 * Usage:
 * ```typescript
 * import { HttpStatus } from '../utils/httpStatus';
 *
 * // Instead of: reply.code(200).send(...)
 * reply.code(HttpStatus.OK).send(...);
 *
 * // Instead of: reply.code(404).send(...)
 * reply.code(HttpStatus.NOT_FOUND).send(...);
 * ```
 */

export const HttpStatus = {
  // 2xx Success
  OK: 200,
  CREATED: 201,
  MULTI_STATUS: 207,

  // 4xx Client Errors
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  CLIENT_CLOSED_REQUEST: 499, // Nginx extension for aborted requests

  // 5xx Server Errors
  BAD_GATEWAY: 502,
  INTERNAL_SERVER_ERROR: 500,
  INSUFFICIENT_STORAGE: 507,
} as const;

// Type for TypeScript type checking
export type HttpStatusCode = (typeof HttpStatus)[keyof typeof HttpStatus];

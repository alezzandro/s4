import crypto from 'crypto';
import { createLogger } from './logger';

const logger = createLogger(undefined, '[SSE Tickets]');

/**
 * SSE One-Time Ticket Authentication System
 *
 * Provides secure, short-lived, single-use tickets for Server-Sent Events (SSE) authentication.
 * Replaces JWT query parameters to prevent token leakage in URL logs.
 *
 * Security Features:
 * - 256-bit random tickets (crypto.randomBytes)
 * - 60-second TTL (configurable)
 * - Single-use (deleted after validation)
 * - Resource-scoped (tied to specific jobId or encodedKey)
 * - Periodic cleanup of expired tickets
 */

/**
 * Ticket data stored in memory
 */
export interface TicketData {
  userId: string; // User ID from JWT
  username: string; // Username for logging
  roles: string[]; // User roles
  createdAt: number; // Timestamp (ms) when ticket was created
  expiresAt: number; // Timestamp (ms) when ticket expires
  resource: string; // Resource identifier (jobId or encodedKey)
  resourceType: 'transfer' | 'upload'; // Type of SSE endpoint
}

/**
 * In-memory ticket store
 * Key: ticket (Base64url-encoded random bytes)
 * Value: TicketData
 */
const ticketStore = new Map<string, TicketData>();

/**
 * Ticket TTL in seconds (configurable via environment variable)
 */
const TICKET_TTL_SECONDS = parseInt(process.env.SSE_TICKET_TTL_SECONDS || '60', 10);

/**
 * Metrics for monitoring ticket usage
 */
let metricsStore = {
  ticketsGenerated: 0,
  ticketsValidated: 0,
  ticketsExpired: 0,
  ticketsInvalidResource: 0,
  ticketsInvalidType: 0,
  ticketsNotFound: 0,
};

/**
 * Generate a secure random ticket and store it
 *
 * @param userId - User ID from authenticated JWT
 * @param username - Username for logging
 * @param roles - User roles
 * @param resource - Resource identifier (jobId or encodedKey)
 * @param resourceType - Type of SSE endpoint ('transfer' or 'upload')
 * @returns Object containing the ticket and expiration timestamp
 */
export function generateSseTicket(
  userId: string,
  username: string,
  roles: string[],
  resource: string,
  resourceType: 'transfer' | 'upload',
): { ticket: string; expiresAt: number } {
  // Generate 256-bit random ticket
  const randomBytes = crypto.randomBytes(32);

  // Base64url encoding (URL-safe, no padding)
  const ticket = randomBytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  // Calculate expiration
  const now = Date.now();
  const expiresAt = now + TICKET_TTL_SECONDS * 1000;

  // Store ticket data
  const ticketData: TicketData = {
    userId,
    username,
    roles,
    createdAt: now,
    expiresAt,
    resource,
    resourceType,
  };

  ticketStore.set(ticket, ticketData);

  // Update metrics
  metricsStore.ticketsGenerated++;

  logger.info(
    {
      username,
      resource,
      resourceType,
      expiresIn: TICKET_TTL_SECONDS,
      storeSize: ticketStore.size,
    },
    'Generated SSE ticket',
  );

  return { ticket, expiresAt };
}

/**
 * Validate and consume a ticket (single-use)
 *
 * @param ticket - The ticket to validate
 * @param resource - Resource identifier from URL (jobId or encodedKey)
 * @param resourceType - Expected resource type ('transfer' or 'upload')
 * @returns TicketData if valid, null if invalid/expired/mismatched
 */
export function validateSseTicket(
  ticket: string,
  resource: string,
  resourceType: 'transfer' | 'upload',
): TicketData | null {
  // Check if ticket exists
  const ticketData = ticketStore.get(ticket);

  if (!ticketData) {
    metricsStore.ticketsNotFound++;
    logger.debug('Ticket not found (may be expired or invalid)');
    return null;
  }

  // Check if ticket has expired
  const now = Date.now();
  if (now > ticketData.expiresAt) {
    // Remove expired ticket
    ticketStore.delete(ticket);
    metricsStore.ticketsExpired++;
    logger.debug({ resource, resourceType }, 'Ticket expired');
    return null;
  }

  // Validate resource type matches
  if (ticketData.resourceType !== resourceType) {
    metricsStore.ticketsInvalidType++;
    logger.warn(
      {
        expected: ticketData.resourceType,
        actual: resourceType,
      },
      'Resource type mismatch',
    );
    return null;
  }

  // Validate resource matches (scoped access)
  if (ticketData.resource !== resource) {
    metricsStore.ticketsInvalidResource++;
    logger.warn(
      {
        expected: ticketData.resource,
        actual: resource,
      },
      'Resource mismatch',
    );
    return null;
  }

  // Ticket is valid - remove it (single-use enforcement)
  ticketStore.delete(ticket);
  metricsStore.ticketsValidated++;

  logger.info(
    {
      username: ticketData.username,
      resource,
      resourceType,
      storeSize: ticketStore.size,
    },
    'Validated SSE ticket',
  );

  return ticketData;
}

/**
 * Clean up expired tickets from the store
 * Called periodically to prevent memory growth
 */
export function cleanupExpiredTickets(): void {
  const now = Date.now();
  let cleaned = 0;

  for (const [ticket, data] of ticketStore.entries()) {
    if (now > data.expiresAt) {
      ticketStore.delete(ticket);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(
      {
        cleaned,
        storeSize: ticketStore.size,
      },
      'Cleaned up expired tickets',
    );
  }
}

/**
 * Get current ticket store size (for monitoring/debugging)
 */
export function getTicketStoreSize(): number {
  return ticketStore.size;
}

/**
 * Get all tickets (for debugging only)
 * DO NOT expose this in production API
 */
export function getAllTickets(): TicketData[] {
  return Array.from(ticketStore.values());
}

/**
 * Get metrics for monitoring
 */
export function getMetrics(): typeof metricsStore {
  return { ...metricsStore };
}

/**
 * Reset metrics (testing only)
 */
export function resetMetrics(): void {
  metricsStore = {
    ticketsGenerated: 0,
    ticketsValidated: 0,
    ticketsExpired: 0,
    ticketsInvalidResource: 0,
    ticketsInvalidType: 0,
    ticketsNotFound: 0,
  };
}

/**
 * Clear all tickets (testing only)
 */
export function clearAllTickets(): void {
  ticketStore.clear();
  logger.warn('Cleared all tickets');
}

/**
 * Start periodic cleanup timer
 * Runs every 60 seconds to remove expired tickets
 */
const cleanupInterval = setInterval(() => {
  cleanupExpiredTickets();
}, 60000);

// Ensure cleanup doesn't prevent process from exiting
cleanupInterval.unref();

logger.info(
  {
    ttlSeconds: TICKET_TTL_SECONDS,
    cleanupIntervalSeconds: 60,
  },
  'SSE ticket system initialized',
);

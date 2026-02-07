import {
  generateSseTicket,
  validateSseTicket,
  cleanupExpiredTickets,
  getTicketStoreSize,
  getMetrics,
  resetMetrics,
  clearAllTickets,
  getAllTickets,
  TicketData,
} from '../../utils/sseTickets';

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

describe('SSE Tickets Utility', () => {
  beforeEach(() => {
    // Clear all tickets and reset metrics before each test
    clearAllTickets();
    resetMetrics();
  });

  describe('generateSseTicket', () => {
    it('should generate a valid ticket with correct structure', () => {
      const result = generateSseTicket('user123', 'testuser', ['admin'], 'job-456', 'transfer');

      expect(result).toHaveProperty('ticket');
      expect(result).toHaveProperty('expiresAt');
      expect(typeof result.ticket).toBe('string');
      expect(typeof result.expiresAt).toBe('number');
    });

    it('should generate base64url encoded tickets (no +, /, or = characters)', () => {
      // Generate multiple tickets to increase chance of catching encoding issues
      for (let i = 0; i < 10; i++) {
        const result = generateSseTicket('user123', 'testuser', ['admin'], `job-${i}`, 'transfer');

        expect(result.ticket).not.toMatch(/[+/=]/);
        expect(result.ticket).toMatch(/^[A-Za-z0-9_-]+$/);
      }
    });

    it('should generate unique tickets each time', () => {
      const tickets = new Set<string>();

      for (let i = 0; i < 100; i++) {
        const result = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');
        tickets.add(result.ticket);
      }

      // All tickets should be unique
      expect(tickets.size).toBe(100);
    });

    it('should set expiration in the future', () => {
      const before = Date.now();
      const result = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');
      const after = Date.now();

      // Expiration should be at least 50 seconds in the future (default TTL is 60s)
      expect(result.expiresAt).toBeGreaterThan(before + 50000);
      expect(result.expiresAt).toBeLessThanOrEqual(after + 61000);
    });

    it('should store ticket data in the store', () => {
      const initialSize = getTicketStoreSize();

      generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      expect(getTicketStoreSize()).toBe(initialSize + 1);
    });

    it('should update metrics on generation', () => {
      const initialMetrics = getMetrics();

      generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      const newMetrics = getMetrics();
      expect(newMetrics.ticketsGenerated).toBe(initialMetrics.ticketsGenerated + 1);
    });

    it('should store correct ticket data for transfer type', () => {
      generateSseTicket('user123', 'testuser', ['admin', 'user'], 'job-789', 'transfer');

      const allTickets = getAllTickets();
      const ticketData = allTickets[0];

      expect(ticketData.userId).toBe('user123');
      expect(ticketData.username).toBe('testuser');
      expect(ticketData.roles).toEqual(['admin', 'user']);
      expect(ticketData.resource).toBe('job-789');
      expect(ticketData.resourceType).toBe('transfer');
    });

    it('should store correct ticket data for upload type', () => {
      generateSseTicket('user456', 'uploader', ['user'], 'encoded-key-abc', 'upload');

      const allTickets = getAllTickets();
      const ticketData = allTickets[0];

      expect(ticketData.userId).toBe('user456');
      expect(ticketData.username).toBe('uploader');
      expect(ticketData.roles).toEqual(['user']);
      expect(ticketData.resource).toBe('encoded-key-abc');
      expect(ticketData.resourceType).toBe('upload');
    });
  });

  describe('validateSseTicket', () => {
    it('should validate a valid ticket and return ticket data', () => {
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      const result = validateSseTicket(ticket, 'job-123', 'transfer');

      expect(result).not.toBeNull();
      expect(result!.userId).toBe('user123');
      expect(result!.username).toBe('testuser');
      expect(result!.roles).toEqual(['admin']);
    });

    it('should return null for non-existent ticket', () => {
      const result = validateSseTicket('non-existent-ticket', 'job-123', 'transfer');

      expect(result).toBeNull();

      const metrics = getMetrics();
      expect(metrics.ticketsNotFound).toBeGreaterThan(0);
    });

    it('should consume ticket (single-use) after validation', () => {
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      // First validation should succeed
      const result1 = validateSseTicket(ticket, 'job-123', 'transfer');
      expect(result1).not.toBeNull();

      // Second validation should fail (ticket consumed)
      const result2 = validateSseTicket(ticket, 'job-123', 'transfer');
      expect(result2).toBeNull();
    });

    it('should update metrics on successful validation', () => {
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      const initialMetrics = getMetrics();

      validateSseTicket(ticket, 'job-123', 'transfer');

      const newMetrics = getMetrics();
      expect(newMetrics.ticketsValidated).toBe(initialMetrics.ticketsValidated + 1);
    });

    it('should return null when resource does not match', () => {
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      const result = validateSseTicket(ticket, 'job-different', 'transfer');

      expect(result).toBeNull();

      const metrics = getMetrics();
      expect(metrics.ticketsInvalidResource).toBeGreaterThan(0);
    });

    it('should return null when resourceType does not match', () => {
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      const result = validateSseTicket(ticket, 'job-123', 'upload');

      expect(result).toBeNull();

      const metrics = getMetrics();
      expect(metrics.ticketsInvalidType).toBeGreaterThan(0);
    });

    it('should return null for expired ticket', async () => {
      // Generate ticket then manually expire it
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      // Get the ticket and manually set expiration to past
      const allTickets = getAllTickets();
      const ticketData = allTickets.find((t: TicketData) => t.resource === 'job-123');
      if (ticketData) {
        // Manually set expiration to past for testing
        (ticketData as { expiresAt: number }).expiresAt = Date.now() - 1000;
      }

      const result = validateSseTicket(ticket, 'job-123', 'transfer');

      expect(result).toBeNull();

      const metrics = getMetrics();
      expect(metrics.ticketsExpired).toBeGreaterThan(0);
    });

    it('should remove expired ticket from store after failed validation', () => {
      const { ticket } = generateSseTicket('user123', 'testuser', ['admin'], 'job-123', 'transfer');

      const sizeBefore = getTicketStoreSize();

      // Get the ticket and manually set expiration to past
      const allTickets = getAllTickets();
      const ticketData = allTickets.find((t: TicketData) => t.resource === 'job-123');
      if (ticketData) {
        // Manually set expiration to past for testing
        (ticketData as { expiresAt: number }).expiresAt = Date.now() - 1000;
      }

      validateSseTicket(ticket, 'job-123', 'transfer');

      // Store size should decrease (expired ticket removed)
      expect(getTicketStoreSize()).toBe(sizeBefore - 1);
    });
  });

  describe('cleanupExpiredTickets', () => {
    it('should remove expired tickets from the store', () => {
      // Generate some tickets
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      generateSseTicket('user2', 'user2', ['admin'], 'job-2', 'transfer');

      expect(getTicketStoreSize()).toBe(2);

      // Manually expire all tickets
      const allTickets = getAllTickets();
      allTickets.forEach((ticket: TicketData) => {
        (ticket as { expiresAt: number }).expiresAt = Date.now() - 1000;
      });

      cleanupExpiredTickets();

      expect(getTicketStoreSize()).toBe(0);
    });

    it('should not remove valid tickets', () => {
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      generateSseTicket('user2', 'user2', ['admin'], 'job-2', 'transfer');

      const sizeBefore = getTicketStoreSize();

      cleanupExpiredTickets();

      expect(getTicketStoreSize()).toBe(sizeBefore);
    });

    it('should only remove expired tickets, keeping valid ones', () => {
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      generateSseTicket('user2', 'user2', ['admin'], 'job-2', 'transfer');
      generateSseTicket('user3', 'user3', ['admin'], 'job-3', 'transfer');

      // Expire only the first ticket
      const allTickets = getAllTickets();
      const firstTicket = allTickets.find((t: TicketData) => t.resource === 'job-1');
      if (firstTicket) {
        (firstTicket as { expiresAt: number }).expiresAt = Date.now() - 1000;
      }

      cleanupExpiredTickets();

      // Should have removed only the expired ticket
      expect(getTicketStoreSize()).toBe(2);
    });
  });

  describe('getTicketStoreSize', () => {
    it('should return 0 when store is empty', () => {
      expect(getTicketStoreSize()).toBe(0);
    });

    it('should return correct count after adding tickets', () => {
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      expect(getTicketStoreSize()).toBe(1);

      generateSseTicket('user2', 'user2', ['admin'], 'job-2', 'transfer');
      expect(getTicketStoreSize()).toBe(2);

      generateSseTicket('user3', 'user3', ['admin'], 'job-3', 'upload');
      expect(getTicketStoreSize()).toBe(3);
    });

    it('should decrease after ticket validation (consumption)', () => {
      const { ticket } = generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');

      expect(getTicketStoreSize()).toBe(1);

      validateSseTicket(ticket, 'job-1', 'transfer');

      expect(getTicketStoreSize()).toBe(0);
    });
  });

  describe('getMetrics', () => {
    it('should return initial metrics with all zeros', () => {
      const metrics = getMetrics();

      expect(metrics.ticketsGenerated).toBe(0);
      expect(metrics.ticketsValidated).toBe(0);
      expect(metrics.ticketsExpired).toBe(0);
      expect(metrics.ticketsInvalidResource).toBe(0);
      expect(metrics.ticketsInvalidType).toBe(0);
      expect(metrics.ticketsNotFound).toBe(0);
    });

    it('should return a copy of metrics (not the original)', () => {
      const metrics1 = getMetrics();
      const metrics2 = getMetrics();

      // Should be equal but not the same object
      expect(metrics1).toEqual(metrics2);
      expect(metrics1).not.toBe(metrics2);
    });

    it('should track all metric types correctly', () => {
      // Generate ticket
      const { ticket } = generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');

      // Validate successfully
      validateSseTicket(ticket, 'job-1', 'transfer');

      // Try to validate non-existent
      validateSseTicket('non-existent', 'job-1', 'transfer');

      // Generate another and validate with wrong resource
      const { ticket: ticket2 } = generateSseTicket('user2', 'user2', ['admin'], 'job-2', 'transfer');
      validateSseTicket(ticket2, 'wrong-resource', 'transfer');

      // Generate another and validate with wrong type
      const { ticket: ticket3 } = generateSseTicket('user3', 'user3', ['admin'], 'job-3', 'transfer');
      validateSseTicket(ticket3, 'job-3', 'upload');

      const metrics = getMetrics();

      expect(metrics.ticketsGenerated).toBe(3);
      expect(metrics.ticketsValidated).toBe(1);
      expect(metrics.ticketsNotFound).toBe(1);
      expect(metrics.ticketsInvalidResource).toBe(1);
      expect(metrics.ticketsInvalidType).toBe(1);
    });
  });

  describe('resetMetrics', () => {
    it('should reset all metrics to zero', () => {
      // Generate some activity
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      validateSseTicket('non-existent', 'job-1', 'transfer');

      const metricsBefore = getMetrics();
      expect(metricsBefore.ticketsGenerated).toBeGreaterThan(0);

      resetMetrics();

      const metricsAfter = getMetrics();
      expect(metricsAfter.ticketsGenerated).toBe(0);
      expect(metricsAfter.ticketsValidated).toBe(0);
      expect(metricsAfter.ticketsExpired).toBe(0);
      expect(metricsAfter.ticketsInvalidResource).toBe(0);
      expect(metricsAfter.ticketsInvalidType).toBe(0);
      expect(metricsAfter.ticketsNotFound).toBe(0);
    });
  });

  describe('clearAllTickets', () => {
    it('should clear all tickets from the store', () => {
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      generateSseTicket('user2', 'user2', ['admin'], 'job-2', 'upload');
      generateSseTicket('user3', 'user3', ['admin'], 'job-3', 'transfer');

      expect(getTicketStoreSize()).toBe(3);

      clearAllTickets();

      expect(getTicketStoreSize()).toBe(0);
    });
  });

  describe('getAllTickets', () => {
    it('should return empty array when no tickets exist', () => {
      const tickets = getAllTickets();
      expect(tickets).toEqual([]);
    });

    it('should return all ticket data', () => {
      generateSseTicket('user1', 'user1', ['admin'], 'job-1', 'transfer');
      generateSseTicket('user2', 'user2', ['user'], 'job-2', 'upload');

      const tickets = getAllTickets();

      expect(tickets.length).toBe(2);

      const resources = tickets.map((t: TicketData) => t.resource);
      expect(resources).toContain('job-1');
      expect(resources).toContain('job-2');
    });
  });
});

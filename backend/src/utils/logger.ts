/**
 * Logger Utility with Fastify Logger Fallback
 *
 * Provides a consistent logging interface for code that may not have
 * access to Fastify request logger (req.log). Automatically falls back
 * to console.* when no logger instance is provided.
 *
 * Usage Scenarios:
 *
 * 1. Route handlers (PREFERRED - use req.log directly):
 *    req.log.info('Processing request');
 *    req.log.error(error, 'Failed to process');
 *
 * 2. Utilities without request context:
 *    import { createLogger } from './logger';
 *    const logger = createLogger(undefined, '[SSE Tickets]');
 *    logger.info('Operation started');
 *    logger.error('Operation failed');
 *
 * 3. Utilities with optional logger:
 *    import { createLogger } from './logger';
 *    export function myUtility(logger?: Logger) {
 *      const log = createLogger(logger);
 *      log.debug('Processing...');
 *    }
 */

/**
 * Minimal logger interface compatible with Fastify logger
 * Supports the most common log levels
 */
export interface Logger {
  debug(msg: string, ...args: any[]): void;
  debug(obj: object, msg?: string, ...args: any[]): void;
  info(msg: string, ...args: any[]): void;
  info(obj: object, msg?: string, ...args: any[]): void;
  warn(msg: string, ...args: any[]): void;
  warn(obj: object, msg?: string, ...args: any[]): void;
  error(msg: unknown, ...args: any[]): void;
  error(obj: object, msg?: string, ...args: any[]): void;
}

/**
 * Console-based logger fallback
 * Implements Logger interface using console.* methods
 * Used when Fastify request logger is not available
 */
class ConsoleLogger implements Logger {
  private prefix: string;

  constructor(prefix = '[S4]') {
    this.prefix = prefix;
  }

  debug(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      console.debug(`${this.prefix} ${msgOrObj}`, ...args);
    } else {
      console.debug(this.prefix, msgOrObj, ...args);
    }
  }

  info(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      console.info(`${this.prefix} ${msgOrObj}`, ...args);
    } else {
      console.info(this.prefix, msgOrObj, ...args);
    }
  }

  warn(msgOrObj: string | object, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      console.warn(`${this.prefix} ${msgOrObj}`, ...args);
    } else {
      console.warn(this.prefix, msgOrObj, ...args);
    }
  }

  error(msgOrObj: unknown, ...args: any[]): void {
    if (typeof msgOrObj === 'string') {
      console.error(`${this.prefix} ${msgOrObj}`, ...args);
    } else {
      console.error(this.prefix, msgOrObj, ...args);
    }
  }
}

/**
 * Create a logger instance
 *
 * If a Fastify logger is provided (from req.log), it will be used directly.
 * Otherwise, falls back to ConsoleLogger with optional prefix.
 *
 * @param logger - Optional Fastify logger (from req.log)
 * @param prefix - Optional prefix for console fallback (default: '[S4]')
 * @returns Logger instance
 *
 * @example
 * // In utilities without request context
 * const logger = createLogger(undefined, '[SSE Tickets]');
 * logger.info('Ticket generated');
 *
 * @example
 * // In utilities with optional logger parameter
 * function myUtility(logger?: Logger) {
 *   const log = createLogger(logger);
 *   log.debug('Processing...');
 * }
 *
 * @example
 * // In route handlers (PREFERRED - use req.log directly)
 * req.log.info('Processing request'); // Don't use createLogger here
 */
export function createLogger(logger?: Logger, prefix?: string): Logger {
  if (logger) {
    return logger;
  }
  return new ConsoleLogger(prefix);
}

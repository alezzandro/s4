import { FastifyReply } from 'fastify';
import { S3ServiceException } from '@aws-sdk/client-s3';
import { sanitizeErrorForLogging } from './errorLogging';
import { HttpStatus } from './httpStatus';
import { createLogger } from './logger';

// Module-level logger for error handler fallback
const fallbackLogger = createLogger(undefined, '[ErrorHandler]');

export interface ErrorResponse {
  error: string;
  message: string;
}

/**
 * Standardized error handler for S3 operations
 * Handles S3ServiceException with proper HTTP status codes
 *
 * @param error - Error object (preferably S3ServiceException or Error)
 * @param reply - Fastify reply object
 * @param logger - Optional logger (req.log or fastify.log)
 */
export async function handleS3Error(
  error: unknown,
  reply: FastifyReply,
  logger?: { error: (msg: unknown) => void },
): Promise<void> {
  const sanitized = sanitizeErrorForLogging(error);

  if (logger) {
    logger.error(sanitized);
  } else {
    fallbackLogger.error({ error: sanitized }, 'S3 operation error');
  }

  if (error instanceof S3ServiceException) {
    const statusCode = error.$metadata?.httpStatusCode || HttpStatus.INTERNAL_SERVER_ERROR;
    await reply.code(statusCode).send({
      error: error.name || 'S3ServiceException',
      message: error.message || 'An S3 service exception occurred.',
    });
  } else {
    const err = error as Error;
    await reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
      error: err.name || 'UnknownError',
      message: err.message || 'An unexpected error occurred.',
    });
  }
}

/**
 * Generic error handler for non-S3 operations
 *
 * @param error - Error object
 * @param reply - Fastify reply object
 * @param statusCode - HTTP status code (default: 500)
 * @param logger - Optional logger (req.log or fastify.log)
 */
export async function handleError(
  error: unknown,
  reply: FastifyReply,
  statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
  logger?: { error: (msg: unknown) => void },
): Promise<void> {
  const sanitized = sanitizeErrorForLogging(error);

  if (logger) {
    logger.error(sanitized);
  } else {
    fallbackLogger.error({ error: sanitized }, 'Operation error');
  }

  const err = error as Error;
  await reply.code(statusCode).send({
    error: err.name || 'Error',
    message: err.message || 'An unexpected error occurred.',
  });
}

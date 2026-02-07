import { FastifyCorsOptions } from '@fastify/cors';

export function getCorsConfig(): FastifyCorsOptions {
  return {
    origin: true, // Reflect request origin (secure with JWT auth)
    methods: ['GET', 'PUT', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
    exposedHeaders: ['Content-Disposition'],
    credentials: true,
  };
}

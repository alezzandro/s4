import type { User } from '../plugins/auth';
import '@fastify/cookie';

declare module 'fastify' {
  interface FastifyRequest {
    user?: User;
  }
}

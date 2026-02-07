import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'fs';
import * as path from 'path';
import { logAccess } from '../../../utils/logAccess';
import { HttpStatus } from '../../../utils/httpStatus';

interface S4Config {
  disclaimer?: {
    status: string;
  };
}

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);
    try {
      const configFile = await fs.promises.readFile('/opt/app-root/src/.local/share/s4/config', 'utf-8');
      const s4Config: S4Config = JSON.parse(configFile);
      const disclaimer = {
        status: s4Config.disclaimer.status,
      };
      reply.send({ disclaimer });
    } catch (_error) {
      const disclaimer = {
        status: 'unknown',
      };
      reply.send({ disclaimer });
    }
  });

  fastify.put('/', async (req: FastifyRequest, reply: FastifyReply) => {
    logAccess(req);
    // JUSTIFICATION: No request schema defined for this route. Body structure is simple
    // ({ status: string }), but Fastify's body typing requires schema declaration. This
    // documents that validation is intentionally deferred. Consider adding schema in future.
    const { status } = req.body as any;
    const configFilePath = '/opt/app-root/src/.local/share/s4/config';
    let s4Config: S4Config = {};

    try {
      const configFile = await fs.promises.readFile(configFilePath, 'utf-8');
      s4Config = JSON.parse(configFile);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // File does not exist, initialize with an empty object
        s4Config = {};
      } else {
        // Other errors
        reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
          error: error.name || 'File system error',
          message: error.message || 'Error reading config file',
        });
        return;
      }
    }

    const disclaimer = {
      status: status,
    };

    s4Config.disclaimer = disclaimer;

    try {
      await fs.promises.mkdir(path.dirname(configFilePath), {
        recursive: true,
      });
      await fs.promises.writeFile(configFilePath, JSON.stringify(s4Config, null, 2));
      reply.send({ message: 'Disclaimer status updated' });
    } catch (error) {
      reply.code(HttpStatus.INTERNAL_SERVER_ERROR).send({
        error: error.name || 'File system error',
        message: error.message || 'Error writing config file',
      });
    }
  });
};

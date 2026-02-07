import { FastifyInstance } from 'fastify';
import { promises as fs } from 'fs';
import disclaimerRoutes from '../../../../routes/api/disclaimer';

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
  },
}));

// Mock logAccess
jest.mock('../../../../utils/logAccess', () => ({
  logAccess: jest.fn(),
}));

describe('Disclaimer Routes', () => {
  let fastify: FastifyInstance;

  beforeEach(async () => {
    jest.clearAllMocks();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Fastify = require('fastify');
    fastify = Fastify();
    await fastify.register(disclaimerRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /', () => {
    it('should return disclaimer status from config file', async () => {
      const mockConfig = {
        disclaimer: {
          status: 'accepted',
        },
      };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.disclaimer).toEqual({ status: 'accepted' });
    });

    it("should return disclaimer status 'unknown' when file does not exist", async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.disclaimer).toEqual({ status: 'unknown' });
    });

    it("should return disclaimer status 'unknown' when file is malformed", async () => {
      (fs.readFile as jest.Mock).mockResolvedValue('not valid json');

      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.disclaimer).toEqual({ status: 'unknown' });
    });

    it("should return disclaimer status 'unknown' on other read errors", async () => {
      (fs.readFile as jest.Mock).mockRejectedValue(new Error('Permission denied'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.disclaimer).toEqual({ status: 'unknown' });
    });

    it('should read from correct config path', async () => {
      const mockConfig = { disclaimer: { status: 'pending' } };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(fs.readFile).toHaveBeenCalledWith('/opt/app-root/src/.local/share/s4/config', 'utf-8');
    });

    it('should return pending status', async () => {
      const mockConfig = {
        disclaimer: {
          status: 'pending',
        },
      };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.disclaimer.status).toBe('pending');
    });

    it('should return declined status', async () => {
      const mockConfig = {
        disclaimer: {
          status: 'declined',
        },
      };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(mockConfig));

      const response = await fastify.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.disclaimer.status).toBe('declined');
    });
  });

  describe('PUT /', () => {
    it('should update disclaimer status in existing config', async () => {
      const existingConfig = {
        disclaimer: { status: 'unknown' },
        otherKey: 'value',
      };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(existingConfig));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.message).toBe('Disclaimer status updated');

      // Check that writeFile was called with updated config
      expect(fs.writeFile).toHaveBeenCalled();
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.disclaimer.status).toBe('accepted');
      expect(writtenConfig.otherKey).toBe('value'); // Preserve other keys
    });

    it('should create config file if it does not exist', async () => {
      const error = new Error('File not found') as NodeJS.ErrnoException;
      error.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(error);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(200);
      expect(fs.mkdir).toHaveBeenCalledWith('/opt/app-root/src/.local/share/s4', { recursive: true });
    });

    it('should return 500 when read fails with non-ENOENT error', async () => {
      const error = new Error('Permission denied') as NodeJS.ErrnoException;
      error.code = 'EACCES';
      error.name = 'EACCES';
      (fs.readFile as jest.Mock).mockRejectedValue(error);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('EACCES');
    });

    it('should return 500 when write fails', async () => {
      const readError = new Error('File not found') as NodeJS.ErrnoException;
      readError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(readError);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      const writeError = new Error('Disk full') as NodeJS.ErrnoException;
      writeError.name = 'ENOSPC';
      (fs.writeFile as jest.Mock).mockRejectedValue(writeError);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'accepted' },
      });

      expect(response.statusCode).toBe(500);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBe('ENOSPC');
    });

    it('should create parent directory if needed', async () => {
      const readError = new Error('File not found') as NodeJS.ErrnoException;
      readError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(readError);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'accepted' },
      });

      expect(fs.mkdir).toHaveBeenCalledWith('/opt/app-root/src/.local/share/s4', { recursive: true });
    });

    it('should write config with proper formatting', async () => {
      const readError = new Error('File not found') as NodeJS.ErrnoException;
      readError.code = 'ENOENT';
      (fs.readFile as jest.Mock).mockRejectedValue(readError);
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'accepted' },
      });

      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenContent = writeCall[1];

      // Should be formatted with 2-space indentation
      expect(writtenContent).toContain('\n');
      expect(JSON.parse(writtenContent)).toEqual({
        disclaimer: { status: 'accepted' },
      });
    });

    it('should update status to declined', async () => {
      const existingConfig = { disclaimer: { status: 'pending' } };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(existingConfig));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'declined' },
      });

      expect(response.statusCode).toBe(200);
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.disclaimer.status).toBe('declined');
    });

    it('should update status to pending', async () => {
      const existingConfig = { disclaimer: { status: 'accepted' } };
      (fs.readFile as jest.Mock).mockResolvedValue(JSON.stringify(existingConfig));
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      const response = await fastify.inject({
        method: 'PUT',
        url: '/',
        payload: { status: 'pending' },
      });

      expect(response.statusCode).toBe(200);
      const writeCall = (fs.writeFile as jest.Mock).mock.calls[0];
      const writtenConfig = JSON.parse(writeCall[1]);
      expect(writtenConfig.disclaimer.status).toBe('pending');
    });
  });
});

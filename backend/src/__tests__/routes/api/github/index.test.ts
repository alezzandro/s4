import { FastifyInstance } from 'fastify';

// Mock axios
jest.mock('axios');

// Mock config
jest.mock('../../../../utils/config', () => ({
  getProxyConfig: jest.fn().mockReturnValue({ httpProxy: '', httpsProxy: '' }),
}));

// Mock logAccess
jest.mock('../../../../utils/logAccess', () => ({
  logAccess: jest.fn(),
}));

describe('GitHub Routes', () => {
  let fastify: FastifyInstance;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockedAxios: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset modules to clear in-memory cache between tests
    jest.resetModules();

    // Re-require axios after resetModules to get the same mock instance
    // that the route module will use
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    mockedAxios = require('axios') as jest.Mocked<typeof import('axios')>['default'];

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Fastify = require('fastify');
    fastify = Fastify();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const githubRoutes = require('../../../../routes/api/github').default;
    await fastify.register(githubRoutes);
  });

  afterEach(async () => {
    await fastify.close();
  });

  describe('GET /repo-info', () => {
    it('should return stars and forks from GitHub API', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          stargazers_count: 42,
          forks_count: 7,
          full_name: 'rh-aiservices-bu/s4',
        },
      });

      const response = await fastify.inject({
        method: 'GET',
        url: '/repo-info',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.stargazers_count).toBe(42);
      expect(payload.forks_count).toBe(7);
    });

    it('should return cached data on subsequent requests', async () => {
      mockedAxios.get.mockResolvedValue({
        data: {
          stargazers_count: 42,
          forks_count: 7,
        },
      });

      // First request - fetches from API
      await fastify.inject({
        method: 'GET',
        url: '/repo-info',
      });

      // Second request - should use cache
      const response = await fastify.inject({
        method: 'GET',
        url: '/repo-info',
      });

      expect(response.statusCode).toBe(200);
      const payload = JSON.parse(response.payload);
      expect(payload.stargazers_count).toBe(42);
      expect(payload.forks_count).toBe(7);

      // axios.get should only be called once
      expect(mockedAxios.get).toHaveBeenCalledTimes(1);
    });

    it('should return 502 when GitHub API fails with no cache', async () => {
      mockedAxios.get.mockRejectedValue(new Error('Network error'));

      const response = await fastify.inject({
        method: 'GET',
        url: '/repo-info',
      });

      expect(response.statusCode).toBe(502);
      const payload = JSON.parse(response.payload);
      expect(payload.error).toBeDefined();
    });
  });
});

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import axios, { AxiosRequestConfig } from 'axios';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { getProxyConfig } from '../../../utils/config';
import { handleError } from '../../../utils/errorHandler';
import { HttpStatus } from '../../../utils/httpStatus';
import { createLogger } from '../../../utils/logger';

const logger = createLogger(undefined, '[GitHub]');

const GITHUB_REPO_URL = 'https://api.github.com/repos/rh-aiservices-bu/s4';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface GitHubRepoCache {
  stargazers_count: number;
  forks_count: number;
  timestamp: number;
}

let cache: GitHubRepoCache | null = null;

export default async (fastify: FastifyInstance): Promise<void> => {
  fastify.get('/repo-info', async (req: FastifyRequest, reply: FastifyReply) => {
    // Return cached data if still fresh
    if (cache && Date.now() - cache.timestamp < CACHE_TTL_MS) {
      return reply.send({
        stargazers_count: cache.stargazers_count,
        forks_count: cache.forks_count,
      });
    }

    try {
      const { httpsProxy } = getProxyConfig();
      const axiosOptions: AxiosRequestConfig = {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 's4-backend',
        },
        timeout: 10000,
        proxy: false, // Disable axios default proxy handling
      };

      if (httpsProxy) {
        axiosOptions.httpsAgent = new HttpsProxyAgent(httpsProxy);
      }

      const response = await axios.get(GITHUB_REPO_URL, axiosOptions);

      cache = {
        stargazers_count: response.data.stargazers_count,
        forks_count: response.data.forks_count,
        timestamp: Date.now(),
      };

      return reply.send({
        stargazers_count: cache.stargazers_count,
        forks_count: cache.forks_count,
      });
    } catch (error) {
      // Stale-cache fallback: return old data if available
      if (cache) {
        logger.warn('GitHub API request failed, returning stale cache');
        return reply.send({
          stargazers_count: cache.stargazers_count,
          forks_count: cache.forks_count,
        });
      }

      await handleError(error, reply, HttpStatus.BAD_GATEWAY, req.log);
    }
  });
};

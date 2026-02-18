import cors from '@fastify/cors';
import Fastify from 'fastify';

import { env } from './env.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.WEB_ORIGIN,
});

app.get('/health', async () => {
  return {
    status: 'ok',
    service: 'api',
    uptime: process.uptime(),
  };
});

const start = async () => {
  try {
    await app.listen({
      port: env.API_PORT,
      host: env.API_HOST,
    });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

import { RedisManager } from "./RedisManager";
export * from './RedisManager';

const redisManager = new RedisManager({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
});

export default redisManager;


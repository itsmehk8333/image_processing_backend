import { Queue } from 'bullmq';
import IORedis from 'ioredis';

export const connection = new IORedis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null
});

export const imageQueue = new Queue('image-processing', { connection });
export const retryImageQueue = new Queue("retry-image-worker" , {connection});
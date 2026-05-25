import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { imageQueue, retryImageQueue } from '../queues/imageQueue.js';

export function setupBullBoard(app) {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(imageQueue), 
     new  BullMQAdapter(retryImageQueue)
    ],
    serverAdapter
  });

  app.use('/admin/queues', serverAdapter.getRouter());
}
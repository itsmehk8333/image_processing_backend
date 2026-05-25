# 🖼️ Image Processing Backend

A robust, production-ready image processing service built with **Node.js**, **BullMQ**, and **Redis** — featuring background job processing, automatic retry logic, dead letter queues, and real-time progress notifications via **Server-Sent Events (SSE)**.

---

## ✨ Features

- ⚡ **Async image processing** via background job queues
- 🔁 **Automatic retry logic** with exponential backoff
- 💀 **Dead Letter Queue (DLQ)** for permanently failed jobs
- 📡 **Real-time notifications** via Server-Sent Events (SSE)
- 📊 **Bull Dashboard** for queue monitoring
- 🔌 **Redis-backed** job persistence

---

## 🏗️ Architecture

```
User Request
     │
     ▼
POST /generate-image
     │
     ▼
Add job to ──► image-processing (Queue)
     │                │
     │                ▼
     │          imageWorker (processes job)
     │                │
     │         ┌──────┴──────┐
     │       Success       Failure
     │         │               │
     │         ▼               ▼
     │    Return imageUrl   retry-image-worker (Queue)
     │         │               │
     ▼         │         ┌─────┴──────┐
SSE Push ◄────┘        Success     Max Retries
  to client              │               │
                         ▼               ▼
                    Return imageUrl   DLQ (image-dlq)
                         │
                         ▼
                    SSE Push to client
```

---

## 📁 Project Structure

```
image_processing_backend/
├── src/
│   ├── config/
│   │   └── redis.js              # Redis connection config
│   ├── queues/
│   │   └── imageQueue.js         # Queue definitions
│   ├── workers/
│   │   ├── imageWorker.js        # Main queue worker
│   │   └── retryImageWorker.js   # Retry queue worker
│   ├── jobs/
│   │   └── processImage.js       # Shared job handler logic
│   ├── routes/
│   │   ├── imageRoutes.js        # POST /generate-image
│   │   └── sseRoutes.js          # GET /job-progress/:jobId
│   └── app.js                    # Express app + Bull Dashboard
├── .env
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- Redis running locally or via Docker

### 1. Clone the repository

```bash
git clone https://github.com/itsmehk8333/image-processing-backend.git
cd image-processing-backend
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

```env
# .env
REDIS_HOST=localhost
REDIS_PORT=6379
PORT=3000
```

### 4. Start Redis (via Docker)

```bash
docker run -d -p 6379:6379 redis
```

### 5. Run the server

```bash
npm run dev
```

### 6. Open Bull Dashboard

```
http://localhost:3000/admin/queues
```

---

## ⚙️ Queue Configuration

### Queues

| Queue Name | Purpose |
|---|---|
| `image-processing` | Main queue for incoming image jobs |
| `retry-image-worker` | Retry queue for failed jobs |
| `image-dlq` | Dead letter queue — permanently failed jobs |

### Redis Connection

```js
// src/config/redis.js
import IORedis from 'ioredis';

export const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  maxRetriesPerRequest: null,
});
```

### Queue Definitions

```js
// src/queues/imageQueue.js
import { Queue } from 'bullmq';
import { connection } from '../config/redis.js';

export const imageQueue      = new Queue('image-processing',   { connection });
export const retryImageQueue = new Queue('retry-image-worker', { connection });
export const imageDLQ        = new Queue('image-dlq',          { connection });
```

---

## 🔁 Retry Logic

Failed jobs are automatically moved to the retry queue with **exponential backoff**. After exhausting all retry attempts, jobs land in the **Dead Letter Queue**.

```
Attempt 1 fails → retry after 2s
Attempt 2 fails → retry after 4s
Attempt 3 fails → retry after 8s
All failed      → move to DLQ 💀
```

```js
// src/workers/imageWorker.js
import { Worker } from 'bullmq';
import { connection } from '../config/redis.js';
import { retryImageQueue, imageDLQ } from '../queues/imageQueue.js';
import { processImage } from '../jobs/processImage.js';

const imageWorker = new Worker('image-processing', async (job) => {
  await processImage(job.data);
}, { connection });

imageWorker.on('failed', async (job, err) => {
  const attempts = job.attemptsMade;

  if (attempts < 3) {
    const delay = Math.pow(2, attempts) * 1000; // exponential backoff
    await retryImageQueue.add('image', job.data, { delay });
  } else {
    await imageDLQ.add('image', {
      originalData: job.data,
      error: err.message,
      failedAt: new Date().toISOString(),
    });
  }
});
```

### Shared Job Handler

Both the main worker and retry worker call the **same function** — no duplicated logic:

```js
// src/jobs/processImage.js  ← single source of truth
export async function processImage(jobData) {
  const { imageUrl, filters } = jobData;
  // ... image processing logic
}

// src/workers/imageWorker.js
import { processImage } from '../jobs/processImage.js';
const mainWorker = new Worker('image-processing', async (job) => {
  await processImage(job.data);  // 👈 same function
}, { connection });

// src/workers/retryImageWorker.js
import { processImage } from '../jobs/processImage.js';
const retryWorker = new Worker('retry-image-worker', async (job) => {
  await processImage(job.data);  // 👈 same function
}, { connection });
```

---

## 📡 Real-Time Notifications (SSE)

When a user submits an image generation request, the frontend receives a `jobId` and opens an **SSE connection** to listen for completion.

### Backend — SSE Endpoint

```js
const clients = new Map(); // jobId → response

app.get('/job-progress/:jobId', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  clients.set(req.params.jobId, res);
  req.on('close', () => clients.delete(req.params.jobId));
});

// Notify on completion
worker.on('completed', (job, result) => {
  const client = clients.get(job.id);
  if (client) {
    client.write(`data: ${JSON.stringify({ state: 'completed', imageUrl: result.imageUrl })}\n\n`);
    clients.delete(job.id);
  }
});
```

### Frontend — Listening for Updates

```js
const handleGenerate = async () => {
  setLoading(true);

  // 1. Submit job → get jobId
  const res = await fetch('/generate-image', { method: 'POST', body: ... });
  const { jobId } = await res.json();

  // 2. Open SSE connection
  const eventSource = new EventSource(`/job-progress/${jobId}`);

  eventSource.onmessage = (event) => {
    const { state, imageUrl } = JSON.parse(event.data);

    if (state === 'completed') {
      setImageUrl(imageUrl);   // ✅ show image
      setLoading(false);
      eventSource.close();
    }

    if (state === 'failed') {
      setError('Generation failed. Please try again.');
      setLoading(false);
      eventSource.close();
    }
  };
};
```

---

## 📊 Bull Dashboard

Monitor all queues visually at:

```
http://localhost:3000/admin/queues
```

```js
// src/app.js
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { imageQueue, retryImageQueue, imageDLQ } from './queues/imageQueue.js';

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [
    new BullMQAdapter(imageQueue),
    new BullMQAdapter(retryImageQueue),
    new BullMQAdapter(imageDLQ),
  ],
  serverAdapter,
});

app.use('/admin/queues', serverAdapter.getRouter());
```

---

## 📦 Tech Stack

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js | HTTP server |
| BullMQ | Job queue management |
| Redis / IORedis | Queue backend |
| @bull-board | Queue monitoring dashboard |
| SSE | Real-time client notifications |

---

## 📜 Scripts

```bash
npm run dev       # Start with nodemon (hot reload)
npm start         # Start in production
npm run worker    # Run workers separately
```

---

## 🤝 Contributing

Pull requests are welcome! For major changes, please open an issue first to discuss what you'd like to change.

---

## 📄 License

[MIT](LICENSE)

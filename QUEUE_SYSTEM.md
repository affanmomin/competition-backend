# Queue System Documentation

This project includes a complete Redis and BullMQ-based queue system for handling background jobs and cron tasks.

## Features

- **Redis Connection**: Robust Redis client with connection pooling and error handling
- **BullMQ Queues**: Queue, Worker, QueueScheduler, and QueueEvents with timezone support
- **Cron Jobs**: Repeatable jobs with Asia/Kolkata timezone
- **REST API**: Queue management endpoints for health checks and manual job triggers
- **Bull Board UI**: Web-based dashboard for monitoring queues and jobs
- **Graceful Shutdown**: Clean shutdown handling for SIGINT/SIGTERM signals

## Setup

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Start Redis Server

Make sure you have Redis running locally:

```bash
# macOS with Homebrew
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt install redis-server
sudo systemctl start redis-server

# Docker
docker run -p 6379:6379 redis:alpine
```

### 3. Environment Configuration

Copy `.env.example` to `.env` and configure Redis settings:

```bash
cp .env.example .env
```

Update Redis configuration in `.env`:
```bash
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
```

### 4. Start the Server

```bash
pnpm run dev
```

## API Endpoints

### Queue Health Check
```bash
GET /queues/health
```

Returns queue status, Redis connection health, and job counts.

### Manual Report Trigger
```bash
POST /queues/reports/run-now
Content-Type: application/json

{
  "reportType": "daily",
  "payload": { "filters": { "date": "2024-01-01" } },
  "priority": 1
}
```

### Queue Status
```bash
GET /queues/status
```

Returns detailed queue health and recent jobs.

### Job Details
```bash
GET /queues/jobs/:jobId
```

Returns specific job information.

## Bull Board UI

Access the queue monitoring dashboard at:
```
http://localhost:3000/admin/queues
```

Features:
- Real-time job monitoring
- Job retry/delete actions
- Queue statistics
- Job logs and details

## Scheduled Jobs

The system automatically sets up the following cron jobs:

### Daily Reports
- **Schedule**: Every day at 9:00 AM IST
- **Cron**: `0 9 * * *`
- **Job ID**: `daily-report-cron`

### Weekly Reports  
- **Schedule**: Every Monday at 10:00 AM IST
- **Cron**: `0 10 * * 1`
- **Job ID**: `weekly-report-cron`

### Monthly Reports
- **Schedule**: 1st of every month at 11:00 AM IST  
- **Cron**: `0 11 1 * *`
- **Job ID**: `monthly-report-cron`

All cron jobs use the `Asia/Kolkata` timezone.

## Job Processing

Jobs are processed by the `QueueService.processJob()` method. Currently supports:

- **report-generation**: Generates various types of reports
  - `daily`: Daily analytics reports
  - `weekly`: Weekly summary reports  
  - `monthly`: Monthly aggregate reports

## Graceful Shutdown

The system handles graceful shutdown for:

- **SIGINT/SIGTERM**: Clean worker shutdown
- **Queue cleanup**: Wait for active jobs to complete
- **Redis cleanup**: Close Redis connections
- **Server shutdown**: Close Fastify server

## Development

### Adding New Job Types

1. Extend the `ReportsJobData` interface in `src/services/queue-service.ts`
2. Add processing logic in `QueueService.processJob()`
3. Add new cron jobs in `QueueService.setupRepeatableJobs()`

### Custom Shutdown Handlers

Add custom cleanup logic:

```typescript
import { setupGracefulShutdown } from './services/graceful-shutdown-service';

const shutdownService = setupGracefulShutdown(server);

shutdownService.addShutdownHandler(async () => {
  // Your cleanup logic here
  await customCleanup();
});
```

## Monitoring

- **Logs**: All queue activities are logged with appropriate levels
- **Health Checks**: Use `/queues/health` for monitoring
- **Bull Board**: Visual monitoring at `/admin/queues`
- **Metrics**: Job counts, processing times, and failure rates

## Troubleshooting

### Redis Connection Issues

1. Verify Redis is running: `redis-cli ping`
2. Check Redis configuration in `.env`
3. Review logs for connection errors

### Job Processing Failures

1. Check Bull Board UI for failed jobs
2. Review job error messages and stack traces
3. Verify job data structure matches expected interface

### Performance Tuning

- Adjust `BULLMQ_CONCURRENCY` for worker concurrency
- Configure job retention policies in queue options
- Monitor Redis memory usage for large job volumes
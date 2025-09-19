
## Features

- **Fastify Framework**: A fast and low-overhead web framework for Node.js.
- **TypeScript**: Strongly typed JavaScript for better developer experience.
- **Environment Configuration**: `.env` support via `dotenv`.
- **Testing**: Pre-configured with `node:test` and `supertest`.
- **Linting**: Code linting and formatting using Biome.
- **Docker Support**: Dockerfile for containerized deployment.
- **GitHub Actions**: CI/CD pipeline for building, linting, and testing.
- **Dependabot**: Automated dependency updates.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version `22.15.0` recommended, see `.nvmrc`)
- [Docker](https://www.docker.com/) (optional, for containerized deployment)

### Installation

1. Use this repository as a template:

   - Click the **"Use this template"** button on the [GitHub repository page](https://github.com/CodeCompanionBE/code-companion-node-ts-template).
   - Create a new repository based on this template.

2. Clone your newly created repository:

   ```bash
   git clone ...
   cd your-repo-name
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Copy the example environment file and configure it:

   ```bash
   cp .env.example .env
   ```

### Development

Start the development server with hot-reloading:

```bash
npm run dev
```

The server will run on `http://localhost:3000` by default.

### Testing

Run the test suite:

```bash
npm test
```

### Linting

Lint the codebase:

```bash
npm run lint
```

### Docker

Build the Docker image:

```bash
npm run docker:build
```

Run the Docker container:

```bash
npm run docker:run
```

### CI/CD

This repository includes a GitHub Actions workflow for building, linting, and testing the application. The workflow is triggered on pushes and pull requests to the `main` branch.

## Project Structure

```
.
├── src
│   ├── routes          # Fastify route definitions
│   ├── server.ts       # Fastify server setup
│   └── index.ts        # Application entry point
├── .github
│   └── workflows       # GitHub Actions workflows
├── .vscode             # VS Code settings
├── Dockerfile          # Docker configuration
├── package.json        # Project metadata and scripts
├── tsconfig.json       # TypeScript configuration
└── .env.example        # Example environment variables
```

## Scripts

- `npm run dev`: Start the development server.
- `npm test`: Run tests.
- `npm run lint`: Lint the codebase.
- `npm run docker:build`: Build the Docker image.
- `npm run docker:run`: Run the Docker container.

## BullMQ Cron Jobs & Admin UI

### Setup

1. Copy env:

   ```bash
   cp .env.example .env
   ```

2. Start Redis (Docker):

   ```bash
   docker compose up -d redis
   ```

3. Seed the cron schedule (idempotent):

   ```bash
   npm run seed:schedules
   ```

4. Start the app (existing):

   ```bash
   npm start
   ```

5. Start worker in separate terminal:

   ```bash
   npm run worker
   ```

6. Admin UI:

   - Visit `http://localhost:3000/admin`

7. Manual run:

   ```bash
   curl -X POST http://localhost:3000/jobs/daily-report/run-now
   ```

8. List/Clear repeatables:

   ```bash
   npm run repeats:list
   npm run repeats:clear
   ```

Notes:

- Repeatable job `daily-report` runs at `00:05` in `CRON_TZ` (default Asia/Kolkata).
- Jobs retry up to 3 times with exponential backoff.
- Keys are isolated by `QUEUE_PREFIX` using Redis hash-tags.


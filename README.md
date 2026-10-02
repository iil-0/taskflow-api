# TaskFlow API

TaskFlow is a task management API built with Node.js and Express.

## Current Features

- A configurable HTTP server
- A health endpoint to check whether the server is responding
- Request logs with a timestamp, HTTP method and URL
- JSON request parsing with a 100 KB body limit
- Consistent JSON responses for unknown routes and request errors
- Automated tests for the server foundation

Task storage and task management endpoints will be added in subsequent changes.

## Requirements

- Node.js 22 or later
- npm

## Installation

```bash
git clone https://github.com/iil-0/taskflow-api.git
cd taskflow-api
npm ci
```

## Running

```bash
npm start
```

The server listens on **http://localhost:3000** by default. Press `Ctrl+C` to stop it.

For development with automatic restarts:

```bash
npm run dev
```

| Environment variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | TCP port used by the server |
| `HOST` | `127.0.0.1` | Network address to listen on |

Environment variables must be set in the shell; `.env` files are not loaded automatically.

## Health Check

Open `http://localhost:3000/health` in a browser or send `GET /health`.

Response: `200 OK`

```json
{
  "success": true,
  "data": { "status": "ok" }
}
```

An unknown URL returns `404` with a JSON error. Malformed JSON returns `400`, oversized bodies return `413`, and unexpected server errors return `500`.

## Project Structure

```text
src/
  app.js
  middleware/
    logger.js
    notFound.js
    errorHandler.js
test/
  server.test.js
```

## Testing

```bash
npm test
```

Tests start an HTTP server on an available local port and check health responses, request logging, unknown routes, malformed JSON and request size limits.

# TaskFlow API

TaskFlow is a task management API built with Node.js and Express.

## Current Features

- A configurable HTTP server
- A health endpoint to check whether the server is responding
- Request logs with a timestamp, HTTP method and URL
- JSON request parsing with a 100 KB body limit
- Consistent JSON responses for unknown routes and request errors
- Automated tests for the server foundation

## Additional Capabilities

- **Task model and validation:** Reusable task field rules and request validation, ready for the task routes.
- **Persistent task storage:** Task storage operations with unique active IDs, atomic writes and corruption checks.

## Task Input Rules

The task model defines the accepted fields in one place. The validation middleware checks incoming data before later task operations use it.

| Field | Rule |
| --- | --- |
| `title` | Required, non-empty string |
| `description` | Required, non-empty string |
| `priority` | Required: `low`, `medium` or `high` |
| `assignee` | Required, non-empty string |
| `status` | Optional: `pending`, `in-progress` or `completed` |

Leading and trailing whitespace is removed from the four required fields. Empty strings, incorrect types, unknown fields, and server-managed fields such as `id` and timestamps are rejected with a JSON `400` response.

Task IDs must be positive safe integers. The ID validator converts a valid URL parameter such as `"12"` into the number `12`.

## Task Storage

`src/services/taskService.js` provides `getAllTasks()`, `getTaskById(id)`, `createTask(taskData)`, `updateTask(id, taskData)` and `deleteTask(id)`.

- Tasks are stored as UTF-8 JSON in `src/data/tasks.json`. Missing directories and the file are created automatically on the first storage operation.
- File operations are processed in sequence within one service instance to prevent concurrent requests from overwriting each other's changes. Use one service instance per data file in a single server process.
- Changes are written to a temporary file in the same directory before replacing the data file. The temporary file is cleaned up after the operation.
- New tasks receive the largest existing ID plus one, ISO timestamps, and a default status of `pending`. A deleted highest ID may be reused later.
- Updates preserve the creation timestamp and refresh the modification timestamp. Deleted tasks are removed from the file.
- Corrupt JSON, duplicate IDs, or records that do not match the task model produce errors; existing data is not silently reset.

The storage service is ready for the next integration step. Task routes are not connected in this version; `GET /health` remains the available endpoint. The local data file is excluded from Git.

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
  taskModel.js
  services/
    taskService.js
  middleware/
    logger.js
    notFound.js
    errorHandler.js
    taskValidation.js
test/
  server.test.js
```

## Testing

```bash
npm test
```

Tests start an HTTP server on an available local port and check health responses, request logging, unknown routes, malformed JSON and request size limits.

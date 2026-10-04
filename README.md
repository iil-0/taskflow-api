# TaskFlow API

[![Test](https://github.com/iil-0/taskflow-api/actions/workflows/test.yml/badge.svg)](https://github.com/iil-0/taskflow-api/actions/workflows/test.yml)

## About

TaskFlow is a REST API that helps software teams assign tasks to employees and track their status and priority. Data is persisted in a JSON file (`src/data/tasks.json`), so no database is required.

## Features

- Create, list, view, update and delete tasks
- Assign tasks to employees and manage status and priority
- Request logging with timestamp, HTTP method and endpoint
- Input validation with consistent JSON error responses
- Combined status/priority filters, search in title and description, listing by assignee
- Pagination, sorting, and completed/pending task reports
- Serialized file access for concurrent requests and atomic writes through a temporary file
- Sample seed data for a quick demo

## Tech Stack

Node.js, Express 5, JavaScript, JSON and REST, with Nodemon for development. Tests use the built-in Node.js test runner. No database or frontend is needed.

## Requirements

Node.js 22 or later and npm. The server needs write access to the directory that holds the data file.

## Installation

```bash
git clone https://github.com/iil-0/taskflow-api.git
cd taskflow-api
npm install
```

Use `npm ci` for a clean install with the exact versions from the lock file.

## Sample Data

The data file is local and ignored by Git. When it is missing, the app creates it as an empty list on first start. To load the sample tasks from [`src/data/seed.json`](src/data/seed.json):

```bash
npm run seed
```

The script does not overwrite a data file that already contains tasks. Use `npm run seed -- --force` to replace it.

## Running

```bash
npm start
```

The API runs at **http://localhost:3000**. Press `Ctrl+C` to stop it.

Development mode with auto-reload:

```bash
npm run dev
```

Nodemon restarts only when source code changes; saving tasks does not restart the server.

| Variable | Default | Description |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `127.0.0.1` | Address to bind to (use `0.0.0.0` to accept external connections) |
| `TASKS_FILE` | `src/data/tasks.json` | Path of the data file; relative paths resolve from the current directory |

`.env` files are not loaded automatically. Run only one server process per data file. Authentication is out of scope for this project.

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| GET | `/health` | Check whether the server is responding |
| POST | `/tasks` | Create a task |
| GET | `/tasks` | List tasks |
| GET | `/tasks/search?keyword=backend` | Search in title/description |
| GET | `/tasks/assignee/:assignee` | Tasks of an employee |
| GET | `/tasks/:id` | Get a task |
| PUT | `/tasks/:id` | Update a task |
| DELETE | `/tasks/:id` | Delete a task |
| GET | `/reports/completed` | Number of completed tasks |
| GET | `/reports/pending` | Number of pending tasks |
| GET | `/reports/summary` | Overall status summary |

List example: `/tasks?status=pending&priority=high&page=1&limit=10&sort=createdAt&order=desc`.

List responses include `pagination: { page, limit, totalItems, totalPages }`. Defaults are `page=1`, `limit=10`, `sort=createdAt` and `order=asc`. Sort fields are `createdAt`, `updatedAt`, `title`, `priority` and `status`; directions are `asc` and `desc`. Search (title and description) and assignee matching are case-insensitive. `keyword` is required for `/tasks/search`.

Every failure returns a JSON object with `success: false` and an `error` message. Invalid input returns `400`, missing resources return `404`, and unexpected server errors return `500`.

## Example Request / Response

`POST http://localhost:3000/tasks` with `Content-Type: application/json`:

```json
{
  "title": "Build backend API",
  "description": "Complete the task endpoints",
  "priority": "high",
  "assignee": "Musa"
}
```

Response `201 Created`:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Build backend API",
    "description": "Complete the task endpoints",
    "status": "pending",
    "priority": "high",
    "assignee": "Musa",
    "createdAt": "2026-10-03T10:00:00.000Z",
    "updatedAt": "2026-10-03T10:00:00.000Z"
  }
}
```

`PUT` requires `title`, `description`, `priority` and `assignee`. If `status` is omitted, the current status is kept. `id` and the timestamps are managed by the server. Missing or deleted tasks return `404`, and invalid input returns `400`.

## Project Structure

```text
src/
  app.js
  taskModel.js
  controllers/
  routes/
  middleware/
  services/
  data/seed.json
scripts/
  seed.js
test/
  api.test.js
```

## Testing

```bash
npm test
```

The tests send real HTTP requests against temporary data files, so they never change your task data. They cover CRUD, validation, logging, concurrent writes, corrupt files, filtering, search, sorting, pagination, reports, the seed data, and persistence across a real process restart. GitHub Actions runs them on Node.js 22 and 24 on Linux and Windows.

To try the API manually in Postman, send requests to `http://localhost:3000` using the endpoint table and JSON example above. Save the ID returned by `POST /tasks` and use it for detail, update and delete requests. Set `Content-Type: application/json` for POST and PUT.

## Data Storage Notes

Invalid or corrupt data is never silently reset; the API returns an error instead. New IDs are the current maximum ID + 1, so they never collide with existing records. If the task with the highest ID is deleted, that ID may be reused later.

## License

ISC

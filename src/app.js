const express = require('express');
const path = require('node:path');
const createTaskService = require('./services/taskService');
const taskRoutes = require('./routes/taskRoutes');
const reportRoutes = require('./routes/reportRoutes');
const logger = require('./middleware/logger');
const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

function createApp({ dataFile } = {}) {
  const app = express();
  const service = createTaskService(dataFile);
  app.locals.taskService = service;
  app.disable('x-powered-by');
  app.use(logger);
  app.use(express.json({ limit: '100kb' }));
  app.get('/health', (req, res) => res.json({ success: true, data: { status: 'ok' } }));
  app.use('/tasks', taskRoutes(service));
  app.use('/reports', reportRoutes(service));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be an integer between 1 and 65535');
    process.exitCode = 1;
  } else {
    const host = process.env.HOST || '127.0.0.1';
    const dataFile = process.env.TASKS_FILE ? path.resolve(process.env.TASKS_FILE) : undefined;
    const app = createApp({ dataFile });
    app.locals.taskService.getAllTasks().then(() => {
      const server = app.listen(port, host, () => {
        console.log(`TaskFlow API running at http://${host}:${port}`);
      });
      server.on('error', error => {
        console.error(error);
        process.exitCode = 1;
      });
      for (const signal of ['SIGINT', 'SIGTERM']) {
        process.once(signal, () => server.close());
      }
    }).catch(error => {
      console.error('Unable to initialize task storage:', error);
      process.exitCode = 1;
    });
  }
}

module.exports = createApp;

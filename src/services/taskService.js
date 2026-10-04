const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { STATUSES, PRIORITIES } = require('../taskModel');

function createTaskService(dataFile = path.join(__dirname, '../data/tasks.json')) {
  let queue = Promise.resolve();

  function serialize(operation) {
    const result = queue.then(operation);
    queue = result.catch(() => {});
    return result;
  }

  async function readTasks() {
    await fs.mkdir(path.dirname(dataFile), { recursive: true });
    let content;
    try {
      content = await fs.readFile(dataFile, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      try {
        await fs.writeFile(dataFile, '[]\n', { encoding: 'utf8', flag: 'wx' });
      } catch (creationError) {
        if (creationError.code !== 'EEXIST') throw creationError;
      }
      content = await fs.readFile(dataFile, 'utf8');
    }
    const tasks = JSON.parse(content);
    const ids = new Set();
    if (!Array.isArray(tasks) || !tasks.every(task => {
      if (!task || !Number.isSafeInteger(task.id) || task.id < 1 || ids.has(task.id)) return false;
      ids.add(task.id);
      return ['title', 'description', 'assignee'].every(field =>
        typeof task[field] === 'string' && task[field].trim().length > 0)
        && STATUSES.includes(task.status) && PRIORITIES.includes(task.priority)
        && ['createdAt', 'updatedAt'].every(field =>
          typeof task[field] === 'string' && Number.isFinite(Date.parse(task[field])));
    })) {
      throw new Error('Invalid task data file');
    }
    return tasks;
  }

  async function writeTasks(tasks) {
    const temporaryFile = `${dataFile}.${randomUUID()}.tmp`;
    try {
      await fs.writeFile(temporaryFile, `${JSON.stringify(tasks, null, 2)}\n`, 'utf8');
      await fs.rename(temporaryFile, dataFile);
    } finally {
      await fs.rm(temporaryFile, { force: true });
    }
  }

  return {
    getAllTasks: () => serialize(readTasks),
    getTaskById: id => serialize(async () => (await readTasks()).find(task => task.id === id)),
    createTask: taskData => serialize(async () => {
      const tasks = await readTasks();
      const id = tasks.reduce((maximum, task) => Math.max(maximum, task.id), 0) + 1;
      if (!Number.isSafeInteger(id)) throw new Error('Task ID range exhausted');
      const now = new Date().toISOString();
      const task = { ...taskData, id, status: taskData.status ?? 'pending', createdAt: now, updatedAt: now };
      tasks.push(task);
      await writeTasks(tasks);
      return task;
    }),
    updateTask: (id, taskData) => serialize(async () => {
      const tasks = await readTasks();
      const task = tasks.find(item => item.id === id);
      if (!task) return undefined;
      Object.assign(task, taskData, { updatedAt: new Date().toISOString() });
      await writeTasks(tasks);
      return task;
    }),
    deleteTask: id => serialize(async () => {
      const tasks = await readTasks();
      const index = tasks.findIndex(task => task.id === id);
      if (index === -1) return false;
      tasks.splice(index, 1);
      await writeTasks(tasks);
      return true;
    }),
  };
}

module.exports = createTaskService;

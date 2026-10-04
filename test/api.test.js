const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');
const { spawn } = require('node:child_process');
const net = require('node:net');
const createApp = require('../src/app');
const createTaskService = require('../src/services/taskService');

const payload = {
  title: 'Backend API geliştir', description: 'CRUD endpointlerini tamamla',
  priority: 'high', assignee: 'Musa',
};

async function fixture(t) {
  if (!console.log.mock) t.mock.method(console, 'log', () => {});
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskflow-test-'));
  const dataFile = path.join(directory, 'data', 'tasks.json');
  const app = createApp({ dataFile });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await fs.rm(directory, { recursive: true, force: true });
  });
  const request = async (url, { method = 'GET', body, raw, headers = {} } = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}${url}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
      body: raw ?? (body === undefined ? undefined : JSON.stringify(body)),
    });
    assert.match(response.headers.get('content-type'), /application\/json/);
    return { status: response.status, body: await response.json() };
  };
  return { request, dataFile, app };
}

test('CRUD: defaults, timestamps, persistence, update and deletion', async t => {
  const { request, dataFile } = await fixture(t);
  const empty = await request('/tasks');
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body.data, []);
  const created = await request('/tasks', { method: 'POST', body: payload });
  assert.equal(created.status, 201);
  const task = created.body.data;
  assert.equal(task.status, 'pending');
  assert.equal(task.createdAt, task.updatedAt);
  assert.equal(new Date(task.createdAt).toISOString(), task.createdAt);
  assert.deepEqual(JSON.parse(await fs.readFile(dataFile, 'utf8')), [task]);
  assert.deepEqual((await request(`/tasks/${task.id}`)).body.data, task);
  const updated = await request(`/tasks/${task.id}`, {
    method: 'PUT', body: { ...payload, status: 'completed', assignee: 'Ayşe' },
  });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.data.createdAt, task.createdAt);
  assert.ok(updated.body.data.updatedAt >= task.updatedAt);
  assert.equal(updated.body.data.status, 'completed');
  assert.equal(updated.body.data.assignee, 'Ayşe');
  const retainedStatus = await request(`/tasks/${task.id}`, { method: 'PUT', body: payload });
  assert.equal(retainedStatus.body.data.status, 'completed');
  assert.equal((await request(`/tasks/${task.id}`, { method: 'DELETE' })).status, 200);
  assert.deepEqual(JSON.parse(await fs.readFile(dataFile, 'utf8')), []);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const result = await request(`/tasks/${task.id}`, { method, body: method === 'PUT' ? payload : undefined });
    assert.equal(result.status, 404);
    assert.equal(result.body.error, 'Task not found');
  }
});

test('Validation, malformed JSON, invalid IDs, unknown endpoint and logger', async t => {
  const logs = [];
  t.mock.method(console, 'log', message => logs.push(message));
  const { request } = await fixture(t);
  for (const field of ['title', 'description', 'priority', 'assignee']) {
    for (const value of [undefined, '', '  ', 42, null]) {
      assert.equal((await request('/tasks', { method: 'POST', body: { ...payload, [field]: value } })).status, 400);
    }
  }
  for (const body of [[], null, {}, { ...payload, priority: 'urgent' }, { ...payload, status: 'done' },
    { ...payload, id: 90 }, { ...payload, createdAt: '2020-01-01' }]) {
    assert.equal((await request('/tasks', { method: 'POST', body })).status, 400);
  }
  assert.equal((await request('/tasks', { method: 'POST', raw: '{' })).status, 400);
  assert.equal((await request('/tasks', { method: 'POST' })).status, 400);
  for (const id of ['0', '-1', '1abc', '1.2', '9007199254740992']) {
    assert.equal((await request(`/tasks/${id}`)).status, 400);
  }
  assert.deepEqual(await request('/unknown'), {
    status: 404, body: { success: false, error: 'Endpoint not found' },
  });
  assert.ok(logs.every(line => /^\[\d{4}-\d{2}-\d{2}T.*Z\] (GET|POST) \//.test(line)));
  assert.ok(logs.some(line => line.endsWith('GET /unknown')));
  assert.ok(logs.some(line => line.endsWith('POST /tasks')));
});

test('Concurrent writes and deletion gaps do not duplicate IDs or lose tasks', async t => {
  const { request, dataFile } = await fixture(t);
  const results = await Promise.all(Array.from({ length: 20 }, (_, i) =>
    request('/tasks', { method: 'POST', body: { ...payload, title: `Task ${i}` } })));
  assert.ok(results.every(result => result.status === 201));
  assert.equal(new Set(results.map(result => result.body.data.id)).size, 20);
  await request('/tasks/5', { method: 'DELETE' });
  const next = await request('/tasks', { method: 'POST', body: payload });
  assert.equal(next.body.data.id, 21);
  assert.equal(JSON.parse(await fs.readFile(dataFile, 'utf8')).length, 20);
});

test('Corrupt storage returns JSON 500 and is never overwritten', async t => {
  t.mock.method(console, 'error', () => {});
  const { request, dataFile } = await fixture(t);
  await request('/tasks');
  for (const invalid of ['{broken', '{}', '[{"id":1}]']) {
    await fs.writeFile(dataFile, invalid, 'utf8');
    const response = await request('/tasks', { method: 'POST', body: payload });
    assert.deepEqual(response, { status: 500, body: { success: false, error: 'Internal server error' } });
    assert.equal(await fs.readFile(dataFile, 'utf8'), invalid);
  }
  await fs.writeFile(dataFile, '[]', 'utf8');
  assert.equal((await request('/tasks', { method: 'POST', body: payload })).status, 201);
});

test('Filters, search and assignee compose before sorting and pagination', async t => {
  const { request } = await fixture(t);
  const records = [
    { title: 'Zulu', description: 'BACKEND işleri', priority: 'high', status: 'completed', assignee: 'Musa' },
    { title: 'Backend Alpha', description: 'Test', priority: 'low', status: 'pending', assignee: 'MUSA' },
    { title: 'Beta', description: 'Backend geliştirme', priority: 'medium', status: 'in-progress', assignee: 'Ayşe' },
    { title: 'Gamma', description: 'Doküman', priority: 'high', status: 'pending', assignee: 'Musa' },
  ];
  for (const body of records) await request('/tasks', { method: 'POST', body });
  const combined = await request('/tasks?status=pending&priority=high');
  assert.deepEqual(combined.body.data.map(task => task.title), ['Gamma']);
  const search = await request('/tasks/search?keyword=bAcKeNd&sort=title');
  assert.equal(search.status, 200);
  assert.deepEqual(search.body.data.map(task => task.title), ['Backend Alpha', 'Beta', 'Zulu']);
  assert.equal((await request('/tasks?keyword=BACKEND')).body.pagination.totalItems, 3);
  assert.equal((await request('/tasks/assignee/mUsA')).body.pagination.totalItems, 3);
  assert.equal((await request('/tasks/assignee/Ay%C5%9Fe')).body.pagination.totalItems, 1);
  const paged = await request('/tasks/assignee/musa?status=pending&sort=title&order=desc&page=2&limit=1');
  assert.deepEqual(paged.body.pagination, { page: 2, limit: 1, totalItems: 2, totalPages: 2 });
  assert.equal(paged.body.data[0].title, 'Backend Alpha');
  assert.deepEqual((await request('/tasks?sort=priority')).body.data.map(task => task.priority), ['low', 'medium', 'high', 'high']);
  assert.deepEqual((await request('/tasks?sort=status')).body.data.map(task => task.status), ['pending', 'pending', 'in-progress', 'completed']);
  for (const sort of ['createdAt', 'updatedAt']) {
    const items = (await request(`/tasks?sort=${sort}&order=desc`)).body.data;
    assert.deepEqual(items.map(task => task.id), [4, 3, 2, 1]);
  }
  assert.deepEqual((await request('/tasks?page=99')).body.data, []);
  const empty = await request('/tasks/search?keyword=unmatched');
  assert.deepEqual(empty.body.pagination, { page: 1, limit: 10, totalItems: 0, totalPages: 0 });
});

test('Invalid query values and route precedence', async t => {
  const { request } = await fixture(t);
  for (const query of ['page=0', 'page=-1', 'limit=0', 'page=1.2', 'page=abc', 'limit=1e2',
    'page=9007199254740992', 'page=9007199254740991&limit=10', 'status=done', 'priority=urgent',
    'sort=id', 'order=down', 'page=1&page=2', 'status=', 'keyword=%20', 'unknown=value']) {
    assert.equal((await request(`/tasks?${query}`)).status, 400, query);
  }
  assert.equal((await request('/tasks/search')).status, 400);
  assert.equal((await request('/tasks/search?keyword=backend&keyword=api')).status, 400);
  assert.equal((await request('/tasks/search?keyword=backend')).status, 200);
  assert.equal((await request('/tasks/assignee/nobody')).status, 200);
  assert.equal((await request('/tasks/assignee/%20')).status, 400);
});

test('Reports count all records and reflect updates and deletion', async t => {
  const { request } = await fixture(t);
  assert.deepEqual((await request('/reports/summary')).body.summary, {
    totalTasks: 0, completedTasks: 0, pendingTasks: 0, inProgressTasks: 0,
  });
  for (const status of ['pending', 'in-progress', 'completed']) {
    await request('/tasks', { method: 'POST', body: { ...payload, status } });
  }
  assert.deepEqual((await request('/reports/completed')).body, { success: true, completedTasks: 1 });
  assert.deepEqual((await request('/reports/pending')).body, { success: true, pendingTasks: 1 });
  await request('/tasks/1', { method: 'PUT', body: { ...payload, status: 'completed' } });
  await request('/tasks/2', { method: 'DELETE' });
  assert.deepEqual((await request('/reports/summary')).body.summary, {
    totalTasks: 2, completedTasks: 2, pendingTasks: 0, inProgressTasks: 0,
  });
});

test('Default pagination is ten records and reports are unpaginated', async t => {
  const { request } = await fixture(t);
  for (let i = 0; i < 11; i += 1) await request('/tasks', { method: 'POST', body: payload });
  const first = await request('/tasks');
  assert.equal(first.body.data.length, 10);
  assert.deepEqual(first.body.pagination, { page: 1, limit: 10, totalItems: 11, totalPages: 2 });
  assert.equal((await request('/tasks?page=2')).body.data.length, 1);
  assert.equal((await request('/reports/pending')).body.pendingTasks, 11);
});

test('Data survives an actual server process restart', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskflow-restart-'));
  const dataFile = path.join(directory, 'tasks.json');
  const reservation = net.createServer().listen(0, '127.0.0.1');
  await once(reservation, 'listening');
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  let child;
  async function stop() {
    if (child && child.exitCode === null && child.signalCode === null) {
      const exited = once(child, 'exit');
      child.kill();
      await exited;
    }
  }
  t.after(async () => {
    await stop();
    await fs.rm(directory, { recursive: true, force: true });
  });
  async function start() {
    child = spawn(process.execPath, [path.resolve(__dirname, '../src/app.js')], {
      env: { ...process.env, PORT: String(port), TASKS_FILE: dataFile }, windowsHide: true,
    });
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Server startup timed out')), 10000);
      let output = '';
      child.stderr.on('data', chunk => { output += chunk; });
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => { clearTimeout(timeout); reject(new Error(`Server exited ${code}: ${output}`)); });
      child.stdout.on('data', chunk => {
        output += chunk;
        if (output.includes('TaskFlow API running')) { clearTimeout(timeout); resolve(); }
      });
    });
  }
  await start();
  const created = await fetch(`http://127.0.0.1:${port}/tasks`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  });
  assert.equal(created.status, 201);
  const task = (await created.json()).data;
  await stop();
  await start();
  const detail = await fetch(`http://127.0.0.1:${port}/tasks/${task.id}`);
  assert.equal(detail.status, 200);
  assert.deepEqual((await detail.json()).data, task);
});

test('Seed data passes storage validation', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'taskflow-seed-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const dataFile = path.join(directory, 'tasks.json');
  await fs.copyFile(path.resolve(__dirname, '../src/data/seed.json'), dataFile);
  const tasks = await createTaskService(dataFile).getAllTasks();
  assert.ok(tasks.length > 0);
  assert.equal(new Set(tasks.map(task => task.id)).size, tasks.length);
});

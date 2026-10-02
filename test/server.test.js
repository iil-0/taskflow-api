const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const createApp = require('../src/app');

async function startServer(t) {
  const logs = [];
  t.mock.method(console, 'log', message => logs.push(message));
  const server = createApp().listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  }));
  return { baseUrl: `http://127.0.0.1:${server.address().port}`, logs };
}

test('Health endpoint responds with JSON and logs the request', async t => {
  const { baseUrl, logs } = await startServer(t);
  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { success: true, data: { status: 'ok' } });
  assert.ok(logs.some(line => /^\[\d{4}-\d{2}-\d{2}T.*Z\] GET \/health$/.test(line)));
});

test('Unknown endpoints return a JSON 404 response', async t => {
  const { baseUrl } = await startServer(t);
  const response = await fetch(`${baseUrl}/unknown`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { success: false, error: 'Endpoint not found' });
});

test('Malformed JSON returns 400 and is still logged', async t => {
  const { baseUrl, logs } = await startServer(t);
  const response = await fetch(`${baseUrl}/health`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { success: false, error: 'Invalid JSON body' });
  assert.ok(logs.some(line => line.endsWith('POST /health')));
});

test('Oversized JSON returns 413 without stopping the server', async t => {
  const { baseUrl } = await startServer(t);
  const response = await fetch(`${baseUrl}/health`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: 'a'.repeat(101 * 1024) }),
  });
  assert.equal(response.status, 413);
  assert.deepEqual(await response.json(), { success: false, error: 'Request body too large' });
  assert.equal((await fetch(`${baseUrl}/health`)).status, 200);
});

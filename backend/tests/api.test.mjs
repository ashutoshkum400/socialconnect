import test from 'node:test';
import assert from 'node:assert/strict';

test('backend health endpoint returns ok', async () => {
  const response = await fetch('http://127.0.0.1:3001/health');
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.status, 'ok');
});

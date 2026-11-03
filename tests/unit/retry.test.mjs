import { test } from 'node:test';
import assert from 'node:assert/strict';
import { retry } from '../../src/lib.js';

test('retry returns the first successful result', async () => {
  let calls = 0;
  const out = await retry(async () => {
    calls += 1;
    if (calls < 3) throw new Error('busy');
    return 'ok';
  }, { tries: 4, wait: 1 });
  assert.equal(out, 'ok');
  assert.equal(calls, 3);
});

test('retry rethrows after the last attempt', async () => {
  let calls = 0;
  await assert.rejects(retry(async () => {
    calls += 1;
    throw new Error('down');
  }, { tries: 2, wait: 1 }), /down/);
  assert.equal(calls, 2);
});

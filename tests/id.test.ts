import test from 'node:test';
import assert from 'node:assert/strict';
import { createId } from '../lib/id.ts';
void test('private HTTP origins generate random v4 IDs without crypto.randomUUID', () => {
  const source = { getRandomValues: crypto.getRandomValues.bind(crypto) };
  const first = createId(source),
    second = createId(source);
  assert.match(
    first,
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  assert.notEqual(first, second);
});

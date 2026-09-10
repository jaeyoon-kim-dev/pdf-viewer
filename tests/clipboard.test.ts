import test from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from '../lib/clipboard.ts';
void test('copy preserves the selected PDF text through the modern clipboard', async () => {
  let copied = '';
  await copyText('A phrase\nfrom a paper', {
    writeText: async (text) => {
      copied = text;
    },
    fallback: () => {
      throw new Error('Unexpected fallback');
    },
  });
  assert.equal(copied, 'A phrase\nfrom a paper');
});
void test('private HTTP and denied clipboard permissions fall back without silently succeeding', async () => {
  let copied = '';
  const fallback = (text: string) => {
    copied = text;
    return true;
  };
  await copyText('HTTP selection', { fallback });
  assert.equal(copied, 'HTTP selection');
  await copyText('Denied permission', {
    writeText: async () => {
      throw new Error('denied');
    },
    fallback,
  });
  assert.equal(copied, 'Denied permission');
  await assert.rejects(
    copyText('blocked', { fallback: () => false }),
    /Copy was blocked/,
  );
});

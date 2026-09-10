import test from 'node:test';
import assert from 'node:assert/strict';
import { frameQueue } from '../lib/frame-queue.ts';

void test('rapid drag updates paint only the latest range per frame', () => {
  const frames = new Map<number, FrameRequestCallback>();
  let next = 0;
  const painted: number[] = [];
  const queue = frameQueue<number>(
    (value) => painted.push(value),
    (callback) => {
      frames.set(++next, callback);
      return next;
    },
    (id) => {
      frames.delete(id);
    },
  );
  for (let i = 0; i < 100; i++) queue.push(i);
  assert.equal(frames.size, 1);
  frames.get(1)!(0);
  frames.delete(1);
  assert.deepEqual(painted, [99]);
  queue.push(100);
  assert.equal(frames.size, 1);
  queue.clear();
  assert.equal(frames.size, 0);
  assert.deepEqual(painted, [99]);
  queue.push(200);
  frames.get(3)!(0);
  assert.deepEqual(painted, [99, 200]);
});

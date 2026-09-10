import test from 'node:test';
import assert from 'node:assert/strict';
import { fittedWidth, clampZoom, zoomShortcut } from '../lib/reader-view.ts';
void test('fit page respects height and a two-page spread respects both dimensions', () => {
  const single = fittedWidth(1000, 600, 1.4, false);
  assert.equal(single.width, 952);
  assert.ok(single.page * 1.4 <= 520);
  const spread = fittedWidth(1000, 1000, 1.4, true);
  assert.ok(spread.page * 2 + 64 <= 1000);
  assert.ok(spread.page * 1.4 + 80 <= 1000);
  assert.ok(fittedWidth(700, 600, 1.4, false).width < single.width);
});
void test('zoom shortcuts support Command and Control without intercepting ordinary typing', () => {
  for (const modifier of ['metaKey', 'ctrlKey']) {
    const event = {
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      [modifier]: true,
      key: '=',
    };
    assert.equal(zoomShortcut(event), 'in');
    assert.equal(zoomShortcut({ ...event, key: '+' }), 'in');
    assert.equal(zoomShortcut({ ...event, key: '-' }), 'out');
    assert.equal(zoomShortcut({ ...event, key: '0' }), 'reset');
    assert.equal(zoomShortcut({ ...event, altKey: true }), null);
  }
  assert.equal(
    zoomShortcut({ metaKey: false, ctrlKey: false, altKey: false, key: '+' }),
    null,
  );
  assert.equal(clampZoom(1), 25);
  assert.equal(clampZoom(600), 400);
});

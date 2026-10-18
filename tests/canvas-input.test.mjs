import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasPoint, canvasRadius, attachCanvasInput } from '../dist/canvas-input.js';
import { installDialogFallback } from '../dist/browser-support.js';

test('canvasPoint maps client coordinates to board space with padding and zoom', () => {
  const board = { width: 1100, height: 800, ox: 130, oy: 145 };
  const rect = { left: 0, top: 0, width: 1100, height: 800 };
  const p = canvasPoint({ clientX: 550, clientY: 400 }, rect, board, 1);
  assert.equal(p.x, 550 - board.ox);
  assert.equal(p.y, 400 - board.oy);

  const zoomed = canvasPoint({ clientX: 550, clientY: 400 }, rect, board, 2);
  assert.equal(zoomed.x, 550 - board.ox);
  assert.equal(zoomed.y, 400 - board.oy);
});

test('canvasRadius correctly scales touch target radius on mobile viewports', () => {
  const board = { width: 1100, height: 800 };
  // Mobile viewport: canvas rendered at 350px width
  const mobileRect = { width: 350, height: 254.5 };
  const rMobile = canvasRadius(22, mobileRect, board, 1);
  assert.ok(rMobile > 60, 'mobile radius in board units should be large enough for finger contact');

  // Desktop viewport: canvas rendered at 1100px width
  const desktopRect = { width: 1100, height: 800 };
  const rDesktop = canvasRadius(22, desktopRect, board, 1);
  assert.equal(Math.round(rDesktop), 22);
});

function createMockTarget() {
  const map = new Map();
  return {
    addEventListener(type, fn) {
      if (!map.has(type)) map.set(type, []);
      map.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = map.get(type) || [];
      const idx = list.indexOf(fn);
      if (idx >= 0) list.splice(idx, 1);
    },
    dispatch(type, event) {
      const list = [...(map.get(type) || [])];
      for (const fn of list) fn(event);
    }
  };
}

test('attachCanvasInput handles touch event fallback for older mobile browsers', () => {
  const canvas = createMockTarget();
  const windowTarget = createMockTarget();

  let started = false, moved = false, ended = false;
  const detach = attachCanvasInput(canvas, {
    start(p) { started = true; assert.equal(p.pointerType, 'touch'); },
    move(p) { moved = true; assert.equal(p.pointerType, 'touch'); },
    end() { ended = true; }
  }, {
    eventTarget: windowTarget,
    pointerEvents: false
  });

  let prevented = false;
  canvas.dispatch('touchstart', {
    cancelable: true,
    preventDefault() { prevented = true; },
    touches: [{ clientX: 100, clientY: 100, identifier: 1 }],
    changedTouches: [{ clientX: 100, clientY: 100, identifier: 1 }]
  });
  assert.ok(started, 'start handler should be called on touchstart');
  assert.ok(prevented, 'default should be prevented to stop scrolling');

  windowTarget.dispatch('touchmove', {
    cancelable: true,
    preventDefault() {},
    touches: [{ clientX: 110, clientY: 120, identifier: 1 }]
  });
  assert.ok(moved, 'move handler should be called on touchmove');

  windowTarget.dispatch('touchend', {
    cancelable: true,
    preventDefault() {},
    changedTouches: [{ identifier: 1 }]
  });
  assert.ok(ended, 'end handler should be called on touchend');

  detach();
});

test('installDialogFallback polyfills showModal and close for older WebViews', () => {
  const fakeDialog = {
    attributes: {},
    classList: { add(cls) { this.class = cls; } },
    setAttribute(k, v) { this.attributes[k] = v; },
    removeAttribute(k) { delete this.attributes[k]; }
  };
  installDialogFallback([fakeDialog]);
  assert.equal(fakeDialog.classList.class, 'fallback-dialog');
  assert.equal(typeof fakeDialog.showModal, 'function');
  assert.equal(typeof fakeDialog.close, 'function');

  fakeDialog.showModal();
  assert.equal(fakeDialog.attributes.open, '');
  fakeDialog.close();
  assert.equal(fakeDialog.attributes.open, undefined);
});

// Pointer Events on current browsers, Touch Events on older mobile WebViews.
// Capturing a pointer is an enhancement: a rejected capture must not abort a drag.
export function attachCanvasInput(canvas, handlers, {
  eventTarget = globalThis.window,
  pointerEvents = typeof globalThis.PointerEvent === 'function',
  now = () => Date.now()
} = {}) {
  const listeners = [];
  let active = null, lastTouch = -Infinity;
  const listen = (target, type, fn, options = { passive: false }) => {
    target.addEventListener(type, fn, options);
    listeners.push(() => target.removeEventListener(type, fn, options));
  };
  const prevent = e => { if (e && e.cancelable) e.preventDefault(); };
  const point = (p, type, id) => ({ clientX: p.clientX, clientY: p.clientY, pointerType: type, pointerId: id });
  const begin = (e, p) => {
    if (active || !Number.isFinite(p.clientX) || !Number.isFinite(p.clientY)) return false;
    if (handlers.start(p) === false) return false;
    active = p;
    prevent(e);
    return true;
  };
  const move = (e, p) => {
    if (!active || active.pointerId !== p.pointerId) return;
    prevent(e);
    handlers.move(p);
  };
  const end = () => {
    if (!active) return;
    active = null;
    handlers.end?.();
  };

  // Crucial for iOS Safari / Mobile Chrome: prevent touch scrolling on the canvas
  listen(canvas, 'touchstart', prevent);
  listen(canvas, 'touchmove', prevent);

  if (pointerEvents) {
    listen(canvas, 'pointerdown', e => {
      if (e.isPrimary === false || (e.pointerType !== 'touch' && e.button != null && e.button !== 0)) return;
      if (begin(e, point(e, e.pointerType || 'mouse', e.pointerId))) {
        try { canvas.setPointerCapture?.(e.pointerId); } catch {}
      }
    });
    listen(eventTarget, 'pointermove', e => move(e, point(e, e.pointerType || 'mouse', e.pointerId)));
    for (const type of ['pointerup', 'pointercancel']) {
      listen(eventTarget, type, e => { if (active?.pointerId === e.pointerId) end(); });
    }
    listen(canvas, 'lostpointercapture', e => { if (active?.pointerId === e.pointerId) end(); });
  } else {
    listen(canvas, 'touchstart', e => {
      lastTouch = now();
      if (e.touches.length !== 1) { end(); return; }
      const t = e.changedTouches[0];
      begin(e, point(t, 'touch', t.identifier));
    });
    listen(eventTarget, 'touchmove', e => {
      if (!active) return;
      const t = [...e.touches].find(t => t.identifier === active.pointerId) || e.touches[0];
      if (t) move(e, point(t, 'touch', active.pointerId));
    });
    for (const type of ['touchend', 'touchcancel']) {
      listen(eventTarget, type, e => {
        lastTouch = now();
        if ([...e.changedTouches].some(t => t.identifier === active?.pointerId)) end();
      });
    }
    listen(canvas, 'mousedown', e => {
      if (e.button !== 0 || now() - lastTouch < 800) return;
      begin(e, point(e, 'mouse', 'mouse'));
    });
    listen(eventTarget, 'mousemove', e => move(e, point(e, 'mouse', 'mouse')));
    listen(eventTarget, 'mouseup', end);
  }
  listen(eventTarget, 'blur', end);
  return () => { end(); listeners.forEach(remove => remove()); };
}

export function canvasPoint(event, rect, board, zoom = 1) {
  const scale = Math.min(rect.width / board.width, rect.height / board.height);
  const left = rect.left + (rect.width - board.width * scale) / 2;
  const top = rect.top + (rect.height - board.height * scale) / 2;
  return {
    x: ((event.clientX - left) / scale - board.width / 2) / zoom + board.width / 2 - board.ox,
    y: ((event.clientY - top) / scale - board.height / 2) / zoom + board.height / 2 - board.oy
  };
}

export function canvasRadius(cssPixels, rect, board, zoom = 1) {
  return cssPixels / (Math.min(rect.width / board.width, rect.height / board.height) * zoom);
}

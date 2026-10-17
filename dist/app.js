import { StitchState, nearbySamples, splitSubpaths } from './engine.js';
import { patterns, palette, fabrics } from './patterns.js';

const $ = id => document.getElementById(id);
const canvas = $('embroidery');
const ctx = canvas.getContext('2d');
const SIZE = 720, CX = 360, CY = 358, R = 259, OX = 160, OY = 167, ART_SCALE = 1.25;
const STORAGE_KEY = 'little-stitch-work-v1';
const GALLERY_KEY = 'little-stitch-gallery-v1';
const SETTINGS_KEY = 'little-stitch-settings-v1';
const icon = id => `<svg aria-hidden="true"><use href="#i-${id}"/></svg>`;
let settings = readStorage(SETTINGS_KEY, {});
let savedWork = readStorage(STORAGE_KEY, {});
let gallery = readStorage(GALLERY_KEY, []);
if (!Array.isArray(gallery)) gallery = [];
gallery = gallery.filter(a => a && typeof a.image === 'string' && a.image.startsWith('data:image/png;') && patterns.some(p => p.id === a.patternId) && typeof a.date === 'string').slice(-12);
let current = patterns.find(p => p.id === settings.pattern) || patterns[0];
let fabric = fabrics.find(f => f.color === settings.fabric)?.color || fabrics[0].color;
let stitchStyle = ['stem', 'cross', 'running'].includes(settings.style) ? settings.style : 'stem';
let chosenColor = null, speed = 1, zoom = 1, showGuides = true, sound = false;
let samples = [], pathInfo = [], state;
let running = false, drawing = false, previousSample = null, pointer = null;
let activeStitch = null, nextIndex = 0, lastTime = 0, carry = 0, renderNeeded = true;
let saveTimer, toastTimer, audioCtx, lastSound = 0, completedShown = false;
let workDirty = false;
let exportImage = '', exportPatternId = '', exportPercent = 0, exportDate = null;
let storageWarningShown = false;

function readStorage(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value && typeof value === typeof fallback ? value : fallback; }
  catch { return fallback; }
}
function storeStorage(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch {
    if (!storageWarningShown) { toast('浏览器存储暂不可用，请下载图片留存作品'); storageWarningShown = true; }
    return false;
  }
}
function toast(message) {
  $('toast').textContent = message;
  $('toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2800);
}
function saveSettings() {
  storeStorage(SETTINGS_KEY, { pattern: current.id, fabric, style: stitchStyle });
}
function saveNow() {
  clearTimeout(saveTimer);
  if (!workDirty) return;
  savedWork = { ...readStorage(STORAGE_KEY, {}), [current.id]: { ...state.serialize(), fabric } };
  const ok = storeStorage(STORAGE_KEY, savedWork);
  if (ok) workDirty = false;
  $('save-status').innerHTML = icon('check') + (ok ? '进度已自动保存' : '进度保留在本次页面');
}
function scheduleSave() {
  workDirty = true;
  $('save-status').textContent = '正在留下这一针…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveNow, 650);
}
function thumbnail(pattern) {
  return `<svg viewBox="40 40 320 300" aria-hidden="true">${pattern.paths.map(p => `<path d="${p.d}" fill="none" stroke="${p.color}" stroke-width="4.3" stroke-linecap="round" stroke-linejoin="round"/>`).join('')}</svg>`;
}
function buildControls() {
  $('pattern-grid').innerHTML = patterns.map(p => `<button class="pattern-card${p.id === current.id ? ' active' : ''}" data-pattern="${p.id}" aria-pressed="${p.id === current.id}" aria-label="选择${p.name}">${thumbnail(p)}<span>${p.name}</span>${p.id === current.id ? '<b class="card-check" aria-hidden="true">✓</b>' : ''}</button>`).join('');
  $('thread-palette').innerHTML = palette.map(p => `<button class="spool-button" style="--thread-color:${p.color}" data-color="${p.color}" aria-label="使用${p.name}绣线" title="${p.name}" aria-pressed="false"><span class="spool" aria-hidden="true"></span></button>`).join('');
  $('fabric-palette').innerHTML = fabrics.map(f => `<button class="fabric-swatch${fabric === f.color ? ' active' : ''}" data-fabric="${f.color}" style="background:${f.color}" aria-label="使用${f.name}绣布" title="${f.name}" aria-pressed="${fabric === f.color}"></button>`).join('');
  updateStyleButtons();
  $('gallery-count').textContent = gallery.length;
}
function samplePattern() {
  samples = [];
  const continuousPaths = current.paths.flatMap(p => splitSubpaths(p.d).map(d => ({ ...p, d })));
  pathInfo = continuousPaths.map((p, pathIndex) => {
    const svgPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    svgPath.setAttribute('d', p.d);
    const length = svgPath.getTotalLength();
    const count = Math.max(2, Math.ceil(length / 3.4));
    const start = samples.length;
    for (let n = 0; n < count; n++) {
      const from = svgPath.getPointAtLength(n / count * length);
      const to = svgPath.getPointAtLength((n + 1) / count * length);
      samples.push({ id: samples.length, path: pathIndex, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2, x1: from.x, y1: from.y, x2: to.x, y2: to.y, color: p.color });
    }
    return { ...p, path: new Path2D(p.d), start, end: samples.length };
  });
}
function selectPattern(id, initial = false) {
  if (!initial && id === current.id) return;
  if (!initial) { pause(); endDrawing(); saveNow(); }
  current = patterns.find(p => p.id === id) || patterns[0];
  samplePattern();
  savedWork = readStorage(STORAGE_KEY, {});
  state = new StitchState(samples.length, savedWork[current.id]);
  if (fabrics.some(f => f.color === savedWork[current.id]?.fabric)) fabric = savedWork[current.id].fabric;
  completedShown = state.complete;
  activeStitch = null;
  pointer = null;
  nextIndex = 0;
  zoom = 1;
  updateZoom();
  $('pattern-name').textContent = current.name;
  $('pattern-description').textContent = current.description;
  $('pattern-number').textContent = `NO. ${String(patterns.indexOf(current) + 1).padStart(2, '0')}`;
  $('difficulty').textContent = `${current.difficulty} · ${styleName()}`;
  buildControls();
  updateColorButtons();
  updateProgress();
  if (!initial) saveSettings();
  renderNeeded = true;
}
function styleName() { return {stem: '轮廓绣', cross: '十字绣', running: '平针绣'}[stitchStyle]; }
function updateStyleButtons() {
  document.querySelectorAll('[data-stitch]').forEach(b => {
    const active = b.dataset.stitch === stitchStyle;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active);
  });
}
function updateColorButtons() {
  document.querySelectorAll('[data-color]').forEach(b => {
    const active = b.dataset.color === chosenColor;
    b.classList.toggle('active', active);
    b.setAttribute('aria-pressed', active);
  });
  $('original-colors').classList.toggle('active', chosenColor === null);
  $('original-colors').setAttribute('aria-pressed', chosenColor === null);
  $('thread-name').textContent = chosenColor ? `${palette.find(p => p.color === chosenColor).name} · 接下来的一针，就用这个颜色` : '跟着图案，换上刚刚好的颜色';
}
function updateProgress() {
  $('percent').textContent = state.percent;
  $('progress-fill').style.width = state.percent + '%';
  $('progress').setAttribute('aria-valuenow', state.percent);
  $('stitch-count').textContent = `${state.count} / ${state.total} 针`;
  $('undo').disabled = state.count === 0;
  $('save-art').disabled = state.count === 0;
  $('auto-stitch').disabled = state.complete;
  if (state.complete) {
    $('auto-stitch').innerHTML = icon('check') + '<span>绣好啦</span>';
    $('canvas-hint').innerHTML = '<span class="hint-line"></span>' + icon('heart') + '<span>一针一线，你把可爱绣出来了</span><span class="hint-line"></span>';
  } else {
    $('auto-stitch').innerHTML = icon(running ? 'pause' : 'play') + `<span>${running ? '歇一小会' : state.count ? '继续慢绣' : '开始慢绣'}</span>`;
    $('canvas-hint').innerHTML = '<span class="hint-line"></span>' + icon('needle') + `<span>${running ? '一针一线，慢慢就有了小模样' : '按住并沿虚线拖动，亲手绣出一点可爱'}</span><span class="hint-line"></span>`;
  }
}

// A deterministic linen texture: real crossing fibres, without external assets.
const linen = document.createElement('canvas');
linen.width = linen.height = 120;
const lc = linen.getContext('2d');
let seed = 2156;
function random() { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }
for (let y = 0; y < 120; y += 2) {
  lc.strokeStyle = `rgba(125,111,77,${0.025 + random() * .038})`;
  lc.lineWidth = .45 + random() * .6;
  lc.beginPath(); lc.moveTo(0, y + random()); lc.lineTo(120, y); lc.stroke();
}
for (let x = 0; x < 120; x += 2.4) {
  lc.strokeStyle = `rgba(255,255,240,${.12 + random() * .25})`;
  lc.lineWidth = .65;
  lc.beginPath(); lc.moveTo(x, 0); lc.lineTo(x + .4, 120); lc.stroke();
}
for (let i = 0; i < 1000; i++) {
  lc.fillStyle = random() > .5 ? '#6a5d3d0b' : '#fffef52a';
  lc.fillRect(random() * 120, random() * 120, .6, 1.5);
}
const fibrePattern = ctx.createPattern(linen, 'repeat');
function roundedRect(c, x, y, width, height, radius) { c.beginPath(); c.roundRect(x, y, width, height, radius); }
function drawHoop(c) {
  // Wood, metal fastening and the double rim are rendered at export resolution too.
  c.save();
  c.shadowColor = '#6b543b27'; c.shadowBlur = 20; c.shadowOffsetY = 13;
  c.fillStyle = '#bfa477'; c.beginPath(); c.arc(CX, CY, R + 21, 0, Math.PI * 2); c.fill();
  c.shadowColor = 'transparent';
  const wood = c.createLinearGradient(70, 90, 645, 640);
  wood.addColorStop(0, '#dbc59a'); wood.addColorStop(.24, '#cdb486'); wood.addColorStop(.5, '#e5d0a4'); wood.addColorStop(.72, '#bfa170'); wood.addColorStop(1, '#ddc694');
  c.fillStyle = wood; c.beginPath(); c.arc(CX, CY, R + 19, 0, Math.PI * 2); c.fill();
  for (let i = 0; i < 9; i++) {
    c.strokeStyle = i % 2 ? '#fff4d236' : '#8b70492b'; c.lineWidth = .65;
    c.beginPath(); c.arc(CX, CY, R + 2 + i * 1.8, 0, Math.PI * 2); c.stroke();
  }
  c.strokeStyle = '#a98a5e'; c.lineWidth = 1;
  c.beginPath(); c.arc(CX, CY, R + 19, 0, Math.PI * 2); c.stroke();
  c.fillStyle = fabric; c.beginPath(); c.arc(CX, CY, R, 0, Math.PI * 2); c.fill();
  c.save(); c.beginPath(); c.arc(CX, CY, R - .5, 0, Math.PI * 2); c.clip();
  c.fillStyle = fibrePattern; c.fillRect(CX - R, CY - R, R * 2, R * 2);
  const shade = c.createRadialGradient(CX - 20, CY - 20, R * .6, CX, CY, R);
  shade.addColorStop(0, '#fff8dd00'); shade.addColorStop(.92, '#8b764806'); shade.addColorStop(1, '#7c653d29');
  c.fillStyle = shade; c.fillRect(CX - R, CY - R, R * 2, R * 2); c.restore();
  c.strokeStyle = '#a98c5c99'; c.lineWidth = 2.5;
  c.beginPath(); c.arc(CX, CY, R + .5, 0, Math.PI * 2); c.stroke();
  c.strokeStyle = '#f7e8bd'; c.lineWidth = 1;
  c.beginPath(); c.arc(CX, CY, R + 3, 0, Math.PI * 2); c.stroke();
  // The clamp sits at twelve o'clock.
  c.fillStyle = '#c1a471'; roundedRect(c, CX - 28, CY - R - 33, 20, 29, 3); c.fill();
  roundedRect(c, CX + 8, CY - R - 33, 20, 29, 3); c.fill();
  c.fillStyle = '#d9c49b'; roundedRect(c, CX - 24, CY - R - 33, 13, 27, 2); c.fill();
  roundedRect(c, CX + 11, CY - R - 33, 13, 27, 2); c.fill();
  const metal = c.createLinearGradient(0, CY - R - 30, 0, CY - R - 19);
  metal.addColorStop(0, '#8b8878'); metal.addColorStop(.4, '#dedbc8'); metal.addColorStop(1, '#96917a');
  c.fillStyle = metal; roundedRect(c, CX - 35, CY - R - 26, 71, 7, 2); c.fill();
  c.fillStyle = '#a19a80'; roundedRect(c, CX + 29, CY - R - 29, 9, 13, 2); c.fill();
  c.strokeStyle = '#e8e1c7'; c.lineWidth = .8;
  for (let i = 0; i < 3; i++) { c.beginPath(); c.moveTo(CX + 31 + i * 2, CY - R - 28); c.lineTo(CX + 31 + i * 2, CY - R - 17); c.stroke(); }
  c.restore();
}
function setArtTransform(c) {
  c.translate(CX, CY); c.scale(zoom * ART_SCALE, zoom * ART_SCALE); c.translate(-CX, -CY);
  c.translate(OX, OY);
}
function drawStitch(c, sample, mark) {
  const dx = sample.x2 - sample.x1, dy = sample.y2 - sample.y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const style = mark.style;
  if (style === 'running' && sample.id % 3 === 2) return;
  function stroke(offset, width, color) {
    c.beginPath();
    if (style === 'cross') {
      const tx = dx / len * 2.5, ty = dy / len * 2.5;
      c.moveTo(sample.x - tx + nx * 2.5, sample.y - ty + ny * 2.5 + offset);
      c.lineTo(sample.x + tx - nx * 2.5, sample.y + ty - ny * 2.5 + offset);
      c.moveTo(sample.x - tx - nx * 2.5, sample.y - ty - ny * 2.5 + offset);
      c.lineTo(sample.x + tx + nx * 2.5, sample.y + ty + ny * 2.5 + offset);
    } else {
      c.moveTo(sample.x1 - dx * .1, sample.y1 - dy * .1 + offset);
      c.quadraticCurveTo(sample.x + nx * .7, sample.y + ny * .7 + offset, sample.x2 + dx * .12, sample.y2 + dy * .12 + offset);
    }
    c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.lineJoin = 'round'; c.stroke();
  }
  stroke(1, style === 'cross' ? 2.4 : 4.3, '#68533326');
  stroke(0, style === 'cross' ? 1.8 : 3.35, mark.color);
  stroke(-.65, style === 'cross' ? .55 : 1.0, '#fff5dd75');
  if (style === 'stem') {
    c.strokeStyle = '#fff8e14a'; c.lineWidth = .5;
    c.beginPath(); c.moveTo(sample.x - nx * 1.1 - dx * .25, sample.y - ny * 1.1 - dy * .25);
    c.lineTo(sample.x + nx * 1.1 + dx * .25, sample.y + ny * 1.1 + dy * .25); c.stroke();
  }
  if (style !== 'cross') {
    c.fillStyle = '#594a353c'; c.beginPath(); c.ellipse(sample.x1, sample.y1, .65, .65, 0, 0, Math.PI * 2); c.fill();
  }
}
function drawNeedle(c, timestamp) {
  const s = activeStitch?.sample;
  if (!s || !activeStitch) return;
  const age = timestamp - activeStitch.at;
  if (!running && !drawing && age > 850) return;
  const progress = Math.min(1, age / (running ? 110 / Math.sqrt(speed) : 180));
  const color = activeStitch.color;
  c.save(); c.lineCap = 'round';
  // Loose thread pulls through the new stitch and settles onto the linen.
  const slack = (1 - progress) * 38 + 7;
  c.strokeStyle = color; c.lineWidth = 1.1;
  c.beginPath(); c.moveTo(s.x2, s.y2);
  c.bezierCurveTo(s.x2 + slack, s.y2 + 20, 338, 341, 364, 314); c.stroke();
  const nx = s.x2 + 7 + (1 - progress) * 6, ny = s.y2 - 12 - (1 - progress) * 16;
  const gradient = c.createLinearGradient(nx, ny, nx + 25, ny - 35);
  gradient.addColorStop(0, '#a2a195'); gradient.addColorStop(.5, '#fdfdf4'); gradient.addColorStop(1, '#89897d');
  c.strokeStyle = '#7b786655'; c.lineWidth = 3.4;c.beginPath();c.moveTo(nx + 1, ny + 1);c.lineTo(nx + 24, ny - 34);c.stroke();
  c.strokeStyle = gradient;c.lineWidth = 2.2;c.beginPath();c.moveTo(nx, ny);c.lineTo(nx + 23, ny - 35);c.stroke();
  c.strokeStyle = '#7b7967';c.lineWidth = .7;c.beginPath();c.ellipse(nx + 21, ny - 32, .9, 2.5, .56, 0, Math.PI * 2);c.stroke();
  c.restore();
}
function render(timestamp = performance.now(), exportMode = false) {
  const factor = canvas.width / SIZE;
  ctx.setTransform(factor, 0, 0, factor, 0, 0);
  ctx.clearRect(0, 0, SIZE, SIZE);
  drawHoop(ctx);
  ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, R - 2, 0, Math.PI * 2); ctx.clip();
  setArtTransform(ctx);
  if (showGuides && !exportMode) {
    ctx.setLineDash([1.5, 3.3]); ctx.lineCap = 'round'; ctx.lineWidth = 1.15;
    for (const p of pathInfo) { ctx.strokeStyle = '#a49571a6'; ctx.stroke(p.path); }
    ctx.setLineDash([]);
  }
  for (const mark of state.marks.values()) drawStitch(ctx, samples[mark.id], mark);
  if (!exportMode) drawNeedle(ctx, timestamp);
  if (pointer && !running && !exportMode && !state.complete) {
    ctx.strokeStyle = chosenColor || '#aa956a'; ctx.globalAlpha = .5; ctx.lineWidth = .7;
    ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pointer.x - 3, pointer.y); ctx.lineTo(pointer.x + 3, pointer.y); ctx.moveTo(pointer.x, pointer.y - 3); ctx.lineTo(pointer.x, pointer.y + 3); ctx.stroke();
  }
  ctx.restore();
  renderNeeded = false;
}
function addStitch(sample, timestamp) {
  const color = chosenColor || sample.color;
  if (state.add(sample.id, color, stitchStyle)) {
    activeStitch = {sample, color, at: timestamp};
    renderNeeded = true;
    needleSound();
    return true;
  }
  return false;
}
function needleSound() {
  if (!sound || performance.now() - lastSound < 70) return;
  try {
    audioCtx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'sine'; osc.frequency.setValueAtTime(650 + Math.random() * 100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(260, audioCtx.currentTime + .045);
    gain.gain.setValueAtTime(.018, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.0001, audioCtx.currentTime + .055);
    osc.connect(gain).connect(audioCtx.destination);osc.start();osc.stop(audioCtx.currentTime + .06);
    lastSound = performance.now();
  } catch { sound = false; updateSoundButton(); }
}
function checkCompletion() {
  if (!state.complete || completedShown) return;
  completedShown = true;
  pause(); saveNow();
  toast('绣好啦！你把今天的可爱留住了');
  setTimeout(() => { if (state.complete && !document.querySelector('dialog[open]')) openExport(); }, 650);
}
function frame(timestamp) {
  const elapsed = Math.min(100, timestamp - (lastTime || timestamp));
  lastTime = timestamp;
  if (running) {
    carry += elapsed * .022 * speed;
    const count = Math.floor(carry); carry -= count;
    let changed = false;
    for (let i = 0; i < count; i++) {
      while (nextIndex < samples.length && state.marks.has(nextIndex)) nextIndex++;
      if (nextIndex >= samples.length) break;
      changed = addStitch(samples[nextIndex++], timestamp) || changed;
      if (state.pending.length >= 15) state.commit();
    }
    if (changed) { updateProgress(); scheduleSave(); checkCompletion(); }
  }
  if (renderNeeded || (activeStitch && timestamp - activeStitch.at < 950)) render(timestamp);
  requestAnimationFrame(frame);
}
function pause() {
  if (!running) return;
  running = false; carry = 0; state.commit(); updateProgress(); saveNow(); renderNeeded = true;
}
function toggleAuto() {
  if (running) { pause(); return; }
  if (state.complete) return;
  endDrawing(); pointer = null; nextIndex = 0; carry = 0; lastTime = performance.now();
  running = true; updateProgress();
}
function pointFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const scale = Math.min(rect.width / SIZE, rect.height / SIZE);
  const left = rect.left + (rect.width - SIZE * scale) / 2;
  const top = rect.top + (rect.height - SIZE * scale) / 2;
  const x = (event.clientX - left) / scale, y = (event.clientY - top) / scale;
  if (Math.hypot(x - CX, y - CY) > R - 5) return null;
  return {x: (x - CX) / (zoom * ART_SCALE) + CX - OX, y: (y - CY) / (zoom * ART_SCALE) + CY - OY};
}
function sewAt(point) {
  if (!point) { previousSample = null; return; }
  const near = nearbySamples(samples, point, 17 / (zoom * ART_SCALE), previousSample);
  let changed = false;
  near.forEach(s => { changed = addStitch(s, performance.now()) || changed; });
  previousSample = near.length ? near.reduce((a, b) => Math.hypot(a.x - point.x, a.y - point.y) < Math.hypot(b.x - point.x, b.y - point.y) ? a : b) : null;
  if (changed) { updateProgress(); scheduleSave(); checkCompletion(); }
}
function endDrawing() {
  if (!drawing) return;
  drawing = false; previousSample = null; state.commit(); saveNow(); renderNeeded = true;
}
canvas.addEventListener('pointerdown', event => {
  if (event.button !== 0 || state.complete) return;
  const point = pointFromEvent(event); if (!point) return;
  pause(); drawing = true; previousSample = null; pointer = point;
  canvas.setPointerCapture(event.pointerId); sewAt(point);
});
canvas.addEventListener('pointermove', event => {
  pointer = pointFromEvent(event); renderNeeded = true;
  if (drawing) sewAt(pointer);
});
canvas.addEventListener('pointerup', endDrawing);
canvas.addEventListener('pointercancel', endDrawing);
canvas.addEventListener('lostpointercapture', endDrawing);
canvas.addEventListener('pointerleave', () => { if (!drawing) { pointer = null; renderNeeded = true; } });
canvas.addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); toggleAuto(); } });
$('auto-stitch').addEventListener('click', toggleAuto);
document.querySelectorAll('[data-speed]').forEach(button => button.addEventListener('click', () => {
  speed = Number(button.dataset.speed);
  document.querySelectorAll('[data-speed]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
}));
$('pattern-grid').addEventListener('click', event => {
  const button = event.target.closest('[data-pattern]'); if (button) selectPattern(button.dataset.pattern);
});
$('thread-palette').addEventListener('click', event => {
  const button = event.target.closest('[data-color]');
  if (button) { chosenColor = button.dataset.color; updateColorButtons(); }
});
$('original-colors').addEventListener('click', () => { chosenColor = null; updateColorButtons(); });
$('stitch-options').addEventListener('click', event => {
  const button = event.target.closest('[data-stitch]');
  if (button) { stitchStyle = button.dataset.stitch; updateStyleButtons(); saveSettings(); $('difficulty').textContent = `${current.difficulty} · ${styleName()}`; }
});
$('fabric-palette').addEventListener('click', event => {
  const button = event.target.closest('[data-fabric]');
  if (button) {
    fabric = button.dataset.fabric;
    document.querySelectorAll('[data-fabric]').forEach(b => { b.classList.toggle('active', b === button); b.setAttribute('aria-pressed', b === button); });
    workDirty = true; saveNow(); saveSettings(); renderNeeded = true;
  }
});
function undo() {
  pause(); endDrawing(); const amount = state.undo();
  if (amount) { workDirty = true; completedShown = false; activeStitch = null; updateProgress(); saveNow(); renderNeeded = true; toast('上一段线已经轻轻拆下了'); }
}
$('undo').addEventListener('click', undo);
document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !document.querySelector('dialog[open]')) { event.preventDefault(); undo(); }
});
$('guides').addEventListener('click', () => {
  showGuides = !showGuides;
  $('guides').classList.toggle('selected', showGuides);
  $('guides').setAttribute('aria-pressed', showGuides);
  $('guides').setAttribute('aria-label', `${showGuides ? '隐藏' : '显示'}图案引导线`);
  renderNeeded = true;
});
function updateZoom() {
  $('zoom-value').textContent = Math.round(zoom * 100) + '%';
  $('zoom-out').disabled = zoom <= .8;
  $('zoom-in').disabled = zoom >= 1.6;
  renderNeeded = true;
}
$('zoom-in').addEventListener('click', () => { zoom = Math.min(1.6, +(zoom + .2).toFixed(1)); updateZoom(); });
$('zoom-out').addEventListener('click', () => { zoom = Math.max(.8, +(zoom - .2).toFixed(1)); updateZoom(); });
$('reset').addEventListener('click', () => { if (state.count) { pause(); $('reset-dialog').showModal(); } else toast('绣布已经准备好，开始第一针吧'); });
$('confirm-reset').addEventListener('click', () => {
  pause(); endDrawing(); state = new StitchState(samples.length); completedShown = false; activeStitch = null;
  workDirty = true; updateProgress(); saveNow(); renderNeeded = true; $('reset-dialog').close(); toast('新的一块绣布，慢慢来就好');
});
function updateSoundButton() {
  $('sound').innerHTML = icon(sound ? 'sound' : 'mute');
  $('sound').setAttribute('aria-pressed', sound);
  $('sound').setAttribute('aria-label', sound ? '关闭针线音效' : '打开针线音效');
}
$('sound').addEventListener('click', () => { sound = !sound; updateSoundButton(); if (sound) { needleSound(); toast('针线音效已打开'); } });

function artImage(width = 1080) {
  const priorZoom = zoom; zoom = 1; render(performance.now(), true);
  const output = document.createElement('canvas'); output.width = width; output.height = Math.round(width * 1.06);
  const c = output.getContext('2d'); c.fillStyle = '#f8f5e9'; c.fillRect(0, 0, output.width, output.height);
  c.drawImage(canvas, 0, -width * .015, width, width);
  c.textAlign = 'center'; c.fillStyle = '#8e7d5c';
  c.font = `${width * .018}px 'Microsoft YaHei', sans-serif`;
  c.fillText(`${current.name}  ·  一针一线`, width / 2, width * .97);
  c.fillStyle = '#b2a78e'; c.font = `${width * .009}px Georgia, serif`;
  c.fillText('A LITTLE JOY, MADE BY YOU', width / 2, width * 1.003);
  zoom = priorZoom; renderNeeded = true;
  return output.toDataURL('image/png');
}
function openExport(item) {
  pause(); endDrawing();
  const p = item ? patterns.find(p => p.id === item.patternId) : current;
  exportImage = item?.image || artImage(); exportPatternId = p.id;
  exportPercent = item?.percent ?? state.percent;
  exportDate = item?.date || null;
  $('export-preview').src = exportImage;
  $('export-preview').alt = `${p.name}，完成度 ${exportPercent}% 的刺绣作品`;
  $('export-title').textContent = exportPercent === 100 ? '你把可爱，一针针绣出来了。' : '这一针，很值得纪念。';
  $('export-caption').textContent = `${p.name} · 已完成 ${exportPercent}% · ${exportPercent === 100 ? '今天的小小成就，送给你。' : '未完成的小美好，也值得被留住。'}`;
  $('collect').disabled = !!item;
  $('collect').innerHTML = icon(item ? 'check' : 'heart') + (item ? '已在收藏里' : '收藏绣作');
  $('export-dialog').showModal();
}
$('save-art').addEventListener('click', () => openExport());
$('collect').addEventListener('click', () => {
  const item = { id: `${Date.now()}-${Math.floor(Math.random() * 10000)}`, patternId: exportPatternId, percent: exportPercent, date: new Date().toISOString(), image: artImage(480) };
  const next = [...gallery, item].slice(-12);
  if (storeStorage(GALLERY_KEY, next)) {
    gallery = next; $('gallery-count').textContent = gallery.length;
    $('collect').disabled = true; $('collect').innerHTML = icon('check') + '已在收藏里'; toast('已收藏，去“我的绣作”就能找到');
  }
});
$('download').addEventListener('click', () => {
  const p = patterns.find(p => p.id === exportPatternId);
  const a = document.createElement('a'); a.href = exportImage;
  a.download = `一针一线-${p.name}-${exportPercent}%.png`;
  document.body.append(a); a.click(); a.remove(); toast('图片已准备好，请在浏览器下载中查看');
});
function openGallery() {
  pause();
  const items = $('gallery-items'); items.replaceChildren();
  if (!gallery.length) {
    items.innerHTML = `<div class="gallery-empty">${icon('book')}<p>这里还空着一小块温柔。<br>绣几针，再把第一份小美好收藏起来吧。</p><button class="primary-btn" data-close>回到刺绣台</button></div>`;
  } else {
    for (const item of [...gallery].reverse()) {
      const p = patterns.find(p => p.id === item.patternId);
      const button = document.createElement('button'); button.className = 'gallery-item';
      button.setAttribute('aria-label', `查看${p.name}，完成 ${item.percent}%`);
      const img = document.createElement('img'); img.src = item.image; img.alt = p.name;
      const meta = document.createElement('span'); meta.className = 'gallery-meta';
      const title = document.createElement('strong'); title.textContent = p.name;
      const detail = document.createElement('small');
      const date = new Date(item.date);
      detail.textContent = `${Number.isFinite(date.getTime()) ? date.toLocaleDateString('zh-CN') : ''} · ${item.percent}%`;
      meta.append(title, detail); button.append(img, meta);
      button.addEventListener('click', () => { $('gallery-dialog').close(); openExport(item); });
      items.append(button);
    }
  }
  $('gallery-dialog').showModal();
}
$('open-gallery').addEventListener('click', openGallery);
$('open-help').addEventListener('click', () => { pause(); $('help-dialog').showModal(); });
$('nav-workbench').addEventListener('click', () => { canvas.focus({preventScroll:true}); });
document.addEventListener('click', event => {
  const closer = event.target.closest('[data-close]');
  if (closer) closer.closest('dialog')?.close();
});
for (const dialog of document.querySelectorAll('dialog')) {
  dialog.addEventListener('click', event => { if (event.target === dialog) {
    const rect = dialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
  } });
}
document.addEventListener('visibilitychange', () => { if (document.hidden) { pause(); endDrawing(); saveNow(); } });
window.addEventListener('pagehide', saveNow);
selectPattern(current.id, true);
requestAnimationFrame(frame);

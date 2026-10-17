import { getLatinGlyph } from './latin-strokes.js';

const shards = new Map();
const clamp = (value, lo, hi, fallback) => Number.isFinite(Number(value)) ? Math.max(lo, Math.min(hi, Number(value))) : fallback;
export function normalizeText(value, options = {}) {
  const text = String(value ?? '').normalize('NFC').replace(/\r\n?/g, '\n').replace(/\t/g, ' ');
  const maxGlyphs = clamp(options.maxGlyphs, 1, 500, 120);
  if (!text.trim()) throw new Error('先写下想绣的文字吧。');
  if ([...text.replace(/\n/g, '')].length > maxGlyphs) throw new Error(`文字最多 ${maxGlyphs} 个字，请分成几幅作品来绣。`);
  if (text.split('\n').length > 12) throw new Error('最多可以排 12 行，请减少一些换行。');
  return text;
}

export function hashSeed(value) {
  let hash = 2166136261;
  for (const c of String(value)) { hash ^= c.codePointAt(0); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
export function seededRandom(seed) {
  let state = typeof seed === 'number' ? seed >>> 0 : hashSeed(seed);
  return () => { state += 0x6d2b79f5; let t = state; t = Math.imul(t ^ t >>> 15, t | 1); t ^= t + Math.imul(t ^ t >>> 7, t | 61); return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

export function shardName(character) { return (character.codePointAt(0) & 255).toString(16).padStart(2, '0'); }
async function loadHanzi(character) {
  const code = character.codePointAt(0);
  if (!(code >= 0x3400 && code <= 0x9fff) && !(code >= 0x20000 && code <= 0x323af)) return null;
  const key = shardName(character);
  if (!shards.has(key)) {
    shards.set(key, fetch(new URL(`./assets/hanzi/${key}.json`, import.meta.url)).then(response => {
      if (!response.ok) throw new Error('汉字针迹暂时没有加载成功，请稍后重试。');
      return response.json();
    }).catch(error => { shards.delete(key); throw error; }));
  }
  const data = await shards.get(key);
  const strokes = data[character];
  return strokes ? { width:1, strokes } : null;
}

// Retain every explicit blank line. Automatic wrapping never truncates text.
export function layoutGlyphs(glyphs, options = {}) {
  const lineWidth = clamp(options.lineWidth, 4, 12, 5.5);
  const lineSpacing = clamp(options.lineSpacing, 1, 2, 1.3);
  const align = ['left', 'center', 'right'].includes(options.align) ? options.align : 'center';
  const rows = [[]];
  let currentWidth = 0;
  for (const glyph of glyphs) {
    if (glyph.character === '\n') { rows.push([]); currentWidth = 0; continue; }
    const advance = glyph.width + .13;
    if (rows.at(-1).length && currentWidth + advance > lineWidth) { rows.push([]); currentWidth = 0; }
    rows.at(-1).push(glyph); currentWidth += advance;
  }
  if (rows.length > 12) throw new Error('这段文字排版超过 12 行，请加大每行字数或减少文字。');
  const widths = rows.map(row => Math.max(0, row.reduce((sum,g) => sum + g.width + .13, 0) - .13));
  const maxWidth = Math.max(...widths, 1);
  const naturalHeight = 1.16 + (rows.length - 1) * lineSpacing;
  const cellSize = Math.min(114, 318 / (maxWidth + .24), 316 / naturalHeight);
  const blockWidth = maxWidth * cellSize;
  const blockHeight = naturalHeight * cellSize;
  const top = (400 - blockHeight) / 2;
  const left = (400 - blockWidth) / 2;
  const items = [];
  rows.forEach((row, rowIndex) => {
    const unused = blockWidth - widths[rowIndex] * cellSize;
    let x = left + (align === 'right' ? unused : align === 'center' ? unused / 2 : 0);
    for (const glyph of row) {
      items.push({ ...glyph, x, y:top + rowIndex * lineSpacing * cellSize, size:cellSize, row:rowIndex });
      x += (glyph.width + .13) * cellSize;
    }
  });
  return { items, rows:rows.length, bounds:{x:left, y:top, width:blockWidth, height:blockHeight}, cellSize, lineWidth, lineSpacing, align };
}

export function resamplePolyline(points, step = 3.5) {
  if (!points.length) return [];
  const out = [[...points[0]]];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1], b = points[i], count = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / step));
    for (let j = 1; j <= count; j++) out.push([a[0] + (b[0] - a[0]) * j / count, a[1] + (b[1] - a[1]) * j / count]);
  }
  return out;
}

// Smooth, low-frequency waviness adds thread tension without breaking legibility.
export function transformStroke(points, placement, options = {}, random = seededRandom(1)) {
  const roughness = clamp(options.roughness, 0, 1, .65);
  const angle = (random() - .5) * .15 * roughness;
  const scale = 1 + (random() - .5) * .075 * roughness;
  const baseline = (random() - .5) * 5 * roughness;
  const phase = random() * Math.PI * 2, phase2 = random() * Math.PI * 2;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const sampled = resamplePolyline(points);
  return sampled.map(([px, py], i) => {
    const previous = sampled[Math.max(0, i - 1)], next = sampled[Math.min(sampled.length - 1, i + 1)];
    const dx = next[0] - previous[0], dy = next[1] - previous[1], distance = Math.hypot(dx,dy) || 1;
    const wobble = (Math.sin(i * .46 + phase) * .46 + Math.sin(i * .14 + phase2) * .30) * roughness;
    const x = (px - 50 - dy / distance * wobble) * scale;
    const y = (py - 50 + dx / distance * wobble) * scale;
    return [placement.x + (50 + x * cos - y * sin) * placement.size / 100, placement.y + (50 + x * sin + y * cos + baseline) * placement.size / 100];
  });
}

export function polylineToPath(points) {
  if (!points.length) return '';
  const f = number => Number(number.toFixed(2));
  return points.map((p,i) => `${i ? 'L' : 'M'}${f(p[0])} ${f(p[1])}`).join(' ');
}

export async function makeTextPattern(value, options = {}) {
  const text = normalizeText(value, options);
  const characters = [...new Set([...text].filter(c => c !== '\n'))];
  const entries = await Promise.all(characters.map(async c => [c, getLatinGlyph(c) || await loadHanzi(c)]));
  const glyphMap = new Map(entries);
  const missing = entries.filter(([,g]) => !g).map(([c]) => c);
  if (missing.length) throw new Error(`暂时还绣不了这些字符：${missing.join('、')}。请换成常用汉字、英文字母或标点。`);
  const normalizedOptions = {
    roughness:clamp(options.roughness, 0, 1, .65),
    texture:options.texture === 'cotton' ? 'cotton' : 'wool',
    color:/^#[0-9a-f]{6}$/i.test(options.color || '') ? options.color : '#cf9290',
    seed:options.seed ?? hashSeed(text),
    align:['left','center','right'].includes(options.align) ? options.align : 'center',
    lineWidth:clamp(options.lineWidth, 4, 12, 5.5),
    lineSpacing:clamp(options.lineSpacing, 1, 2, 1.3),
    maxGlyphs:clamp(options.maxGlyphs, 1, 500, 120)
  };
  const layout = layoutGlyphs([...text].map(c => c === '\n' ? {character:c} : {character:c,...glyphMap.get(c)}), normalizedOptions);
  const paths = [];
  for (let index = 0; index < layout.items.length; index++) {
    const item = layout.items[index];
    // Every stroke in a glyph shares the same gentle handwritten tilt.
    const glyphSeed = hashSeed(`${normalizedOptions.seed}:${index}`);
    for (let strokeIndex = 0; strokeIndex < item.strokes.length; strokeIndex++) {
      const points = transformStroke(item.strokes[strokeIndex], item, normalizedOptions, seededRandom(glyphSeed));
      paths.push({d:polylineToPath(points), color:normalizedOptions.color, handmade:true, texture:normalizedOptions.texture, strokeWidth:normalizedOptions.texture === 'wool' ? 2.1 : 1.5});
    }
  }
  return { id:`text-${hashSeed(text + JSON.stringify(normalizedOptions)).toString(36)}`, group:'text', name:text.length > 12 ? `${[...text].slice(0,11).join('')}…` : text, description:'把心里的话，一针一线慢慢绣下来。', difficulty:'自定义', customText:true, paths, text, options:normalizedOptions, bounds:layout.bounds, layout:{rows:layout.rows, cellSize:layout.cellSize} };
}

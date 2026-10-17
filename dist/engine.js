export class StitchState {
  constructor(total, saved) {
    this.total = total;
    this.marks = new Map();
    this.history = [];
    this.pending = [];
    if (saved?.version === 1 && saved.total === total && Array.isArray(saved.marks)) {
      for (const mark of saved.marks) {
        if (Number.isInteger(mark.id) && mark.id >= 0 && mark.id < total && /^#[0-9a-f]{6}$/i.test(mark.color) && ['stem', 'cross', 'running'].includes(mark.style)) {
          this.marks.set(mark.id, { id: mark.id, color: mark.color, style: mark.style });
        }
      }
      if (this.marks.size) this.history.push([...this.marks.keys()]);
    }
  }
  add(id, color, style) {
    if (!Number.isInteger(id) || id < 0 || id >= this.total || this.marks.has(id)) return false;
    this.marks.set(id, { id, color, style });
    this.pending.push(id);
    return true;
  }
  commit() {
    if (this.pending.length) this.history.push(this.pending.splice(0));
  }
  undo() {
    this.commit();
    const ids = this.history.pop() || [];
    ids.forEach(id => this.marks.delete(id));
    return ids.length;
  }
  get count() { return this.marks.size; }
  get complete() { return this.total > 0 && this.count === this.total; }
  get percent() { return this.complete ? 100 : Math.min(99, Math.floor(this.count / this.total * 100)); }
  serialize() { return { version: 1, total: this.total, marks: [...this.marks.values()] }; }
}

export function nearbySamples(samples, point, radius, previous) {
  let best = null, distance = radius;
  for (const s of samples) {
    const d = Math.hypot(s.x - point.x, s.y - point.y);
    if (d < distance) { best = s; distance = d; }
  }
  if (!best) return [];
  if (previous && previous.path === best.path && Math.abs(previous.id - best.id) < 24) {
    const low = Math.min(previous.id, best.id), high = Math.max(previous.id, best.id);
    return samples.slice(low, high + 1);
  }
  return samples.filter(s => s.path === best.path && Math.abs(s.id - best.id) <= 1);
}

// Each absolute move starts a disconnected piece of embroidery. Sampling the
// whole SVG path would sew a straight line across the gap at every move.
export function splitSubpaths(d) {
  return d.split(/(?=M)/).map(part => part.trim()).filter(Boolean);
}

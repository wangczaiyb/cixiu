// Sample the visible, composited colour fields, so an overlapping muzzle or
// shirt replaces the thread underneath instead of sewing both shapes twice.
export function sampleFillStitches(image, width, height, rowGap = 4, stitchLength = 7) {
  const samples = [];
  const colourAt = (x, y) => {
    const i = (y * width + x) * 4;
    return image[i + 3] > 220
      ? '#' + [image[i], image[i + 1], image[i + 2]].map(v => v.toString(16).padStart(2, '0')).join('')
      : null;
  };
  for (let y = 2; y < height; y += rowGap) {
    let x = 0;
    while (x < width) {
      const color = colourAt(x, y);
      if (!color) { x++; continue; }
      const start = x;
      while (x < width && colourAt(x, y) === color) x++;
      const end = x, path = -(y * width + start + 1);
      let x1 = start, n = 0;
      while (x1 < end) {
        const length = n === 0 && Math.floor(y / rowGap) % 2 ? stitchLength / 2 : stitchLength;
        const x2 = Math.min(end, x1 + length);
        samples.push({ path, n, x1, y1: y - .35, x2, y2: y + .35, x: (x1 + x2) / 2, y,
          color, satin: true, rowGap });
        x1 = x2; n++;
      }
    }
  }
  return samples;
}

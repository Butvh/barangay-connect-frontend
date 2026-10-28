export const clamp = (value, min, max) => Math.max(min, Math.min(max, Number(value) || 0));
export function pointFromViewport(event, rect, {scale, dx, dy}) {
  if (!rect.width || !rect.height || !Number.isFinite(scale) || scale <= 0) return null;
  return { x: clamp((event.clientX - rect.left - dx) / scale / rect.width * 100, 0, 100), y: clamp((event.clientY - rect.top - dy) / scale / rect.height * 100, 0, 100) };
}
export function centeredTransform(point, {width, height}, zoom = 1.5) {
  const scale = clamp(zoom, 1, 3);
  return {scale, dx: clamp(width/2 - point.x/100*width*scale, width*(1-scale), 0), dy: clamp(height/2 - point.y/100*height*scale, height*(1-scale), 0)};
}

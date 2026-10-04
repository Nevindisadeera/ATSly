/** Geometry for a circular score ring drawn with a single stroked SVG circle. */
export type RingGeometry = {
  radius: number;
  center: number;
  circumference: number;
  /** Stroke offset that leaves exactly `value / max` of the circle visible. */
  dashOffset: number;
  /** The clamped value used for drawing. */
  clamped: number;
};

export function ringGeometry(
  value: number,
  size: number,
  strokeWidth: number,
  max = 100,
): RingGeometry {
  const safeMax = max > 0 ? max : 100;
  const clamped = Number.isFinite(value) ? Math.min(Math.max(value, 0), safeMax) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped / safeMax);
  return { radius, center: size / 2, circumference, dashOffset, clamped };
}

/** Stroke width scales with ring size, staying thin at every size. */
export function ringStrokeWidth(size: number): number {
  if (size >= 160) return 6;
  if (size >= 120) return 5;
  return 4;
}

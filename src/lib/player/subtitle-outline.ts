export function buildSubtitleOutline(color: string, size: number): string {
  const radius = Number.isFinite(size) ? Math.max(0, size) : 0;
  const limit = Math.ceil(radius);
  const offsets: Array<[number, number]> = [];
  for (let dx = -limit; dx <= limit; dx++) {
    for (let dy = -limit; dy <= limit; dy++) {
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > radius + 0.1 || distance < 0.1) continue;
      offsets.push([dx, dy]);
    }
  }
  return offsets.map(([dx, dy]) => `${dx}px ${dy}px 0 ${color}`).join(", ");
}

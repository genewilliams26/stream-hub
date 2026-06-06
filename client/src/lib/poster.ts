// Deterministic gradient poster generator — no external image dependency.
// Produces a stable pair of colors from a title so each poster looks distinct
// but consistent across renders. Used when a real posterUrl is absent.

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function posterGradient(title: string): { from: string; to: string; angle: number } {
  const h = hashString(title);
  const hue1 = h % 360;
  const hue2 = (hue1 + 40 + (h % 60)) % 360;
  const angle = 120 + (h % 60);
  // Deep, cinematic tones — low lightness, moderate saturation.
  return {
    from: `hsl(${hue1} 45% 22%)`,
    to: `hsl(${hue2} 55% 10%)`,
    angle,
  };
}

export function initials(title: string): string {
  return title
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

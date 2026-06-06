import type { Availability } from "@/lib/types";

// Streaming-source chip. Shows the service name in its brand color, plus a
// price tag when the offer is a rental/purchase (free offers show "Included").

function readableText(hex: string): string {
  // Choose black/white text based on perceived luminance of the brand color.
  const c = hex.replace("#", "");
  if (c.length < 6) return "#fff";
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.6 ? "#111" : "#fff";
}

export function SourceChip({ a }: { a: Availability }) {
  const fg = readableText(a.color);
  const isPay = a.offerType !== "free";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ backgroundColor: a.color, color: fg }}
      data-testid={`source-${a.serviceId}`}
    >
      {a.serviceName}
      {isPay ? (
        <span className="rounded-full bg-black/25 px-1.5 py-0.5 text-[0.65rem] font-bold tabular-nums">
          {a.offerType === "rent" ? "Rent" : "Buy"} ${a.price.toFixed(2)}
        </span>
      ) : (
        <span className="rounded-full bg-black/20 px-1.5 py-0.5 text-[0.65rem] font-medium">
          Included
        </span>
      )}
    </span>
  );
}

// Williams Family Stream-Hub logo — concentric "broadcast" arcs converging on
// a play triangle. Monochrome, uses currentColor so it adapts to theme.
export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg
        width="28"
        height="28"
        viewBox="0 0 32 32"
        fill="none"
        aria-label="Williams Family Stream-Hub"
        className="text-primary"
      >
        <path
          d="M9 11.5a9.5 9.5 0 0 1 0 9M5 8a14 14 0 0 1 0 16"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
        <path d="M16 10.5 25 16l-9 5.5z" fill="currentColor" />
      </svg>
      <span className="flex flex-col leading-none">
        <span className="text-[0.65rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Williams Family
        </span>
        <span className="text-lg font-semibold tracking-tight text-foreground">
          Stream<span className="text-primary">-Hub</span>
        </span>
      </span>
    </div>
  );
}

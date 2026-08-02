interface SVGProps {
  className?: string;
}

export function TealBlob({ className }: SVGProps) {
  return (
    <svg
      className={className}
      width="280"
      height="280"
      viewBox="0 0 280 280"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M140 18 C 200 18, 252 60, 260 130 C 268 200, 220 248, 158 258 C 96 268, 38 226, 24 162 C 10 98, 80 18, 140 18 Z"
        fill="#3FA39A"
        fillOpacity="0.12"
      />
    </svg>
  );
}

export function CoralArc({ className }: SVGProps) {
  return (
    <svg
      className={className}
      width="220"
      height="220"
      viewBox="0 0 220 220"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 200 20 A 180 180 0 0 1 20 200"
        fill="none"
        stroke="#F2A38F"
        strokeOpacity="0.14"
        strokeWidth="40"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WavyUnderline({ className }: SVGProps) {
  return (
    <svg
      className={className}
      width="80"
      height="12"
      viewBox="0 0 80 12"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 2 6 Q 13 1, 24 6 T 46 6 T 68 6 L 78 6"
        stroke="#F2A38F"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function DotCluster({ className }: SVGProps) {
  const dots: { cx: number; cy: number }[] = [];
  const positions = [
    [10, 10], [32, 8], [56, 12],
    [8, 30], [30, 32], [54, 30],
    [12, 52], [34, 54], [58, 50],
  ];
  for (const [cx, cy] of positions) {
    dots.push({ cx, cy });
  }
  return (
    <svg
      className={className}
      width="72"
      height="64"
      viewBox="0 0 72 64"
      fill="none"
      aria-hidden="true"
    >
      {dots.map((d, i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="3.5" fill="#3FA39A" fillOpacity="0.3" />
      ))}
    </svg>
  );
}

export function HalfArc({ className }: SVGProps) {
  return (
    <svg
      className={className}
      width="380"
      height="190"
      viewBox="0 0 380 190"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M 10 180 A 180 180 0 0 1 370 180"
        fill="none"
        stroke="#3FA39A"
        strokeOpacity="0.08"
        strokeWidth="36"
        strokeLinecap="round"
      />
    </svg>
  );
}

// The district seal — the skeuomorphic anchor of the document surfaces.
// "ink" renders as a rubber-stamp impression (transcript letterhead);
// "foil" renders as an embossed gold seal (certificate).
export function Seal({
  variant = "ink",
  size = 96,
  className,
}: {
  variant?: "ink" | "foil";
  size?: number;
  className?: string;
}) {
  const id = variant === "foil" ? "seal-foil" : "seal-ink";
  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`seal seal-${variant} ${className ?? ""}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e6c878" />
          <stop offset="0.45" stopColor="#c9a24d" />
          <stop offset="0.75" stopColor="#a37c2a" />
          <stop offset="1" stopColor="#dcbd6b" />
        </linearGradient>
        <path id={`${id}-arc`} d="M 60,19.5 a 40.5,40.5 0 1,1 -0.02,0" fill="none" />
      </defs>
      {variant === "foil" && <circle cx="60" cy="60" r="57" fill={`url(#${id}-gold)`} opacity="0.16" />}
      {/* serrated outer ring */}
      <circle
        cx="60"
        cy="60"
        r="55"
        fill="none"
        stroke={variant === "foil" ? `url(#${id}-gold)` : "currentColor"}
        strokeWidth="5"
        strokeDasharray="2.4 3.1"
      />
      <circle
        cx="60"
        cy="60"
        r="49.5"
        fill="none"
        stroke={variant === "foil" ? `url(#${id}-gold)` : "currentColor"}
        strokeWidth="1.6"
      />
      <circle
        cx="60"
        cy="60"
        r="31"
        fill="none"
        stroke={variant === "foil" ? `url(#${id}-gold)` : "currentColor"}
        strokeWidth="1.2"
      />
      <text
        fontSize="8"
        fontFamily="Georgia, serif"
        letterSpacing="1.35"
        fill={variant === "foil" ? `url(#${id}-gold)` : "currentColor"}
      >
        <textPath href={`#${id}-arc`} startOffset="0">
          KEYSTONE VALLEY SCHOOL DISTRICT ✦ PD LEDGER ✦
        </textPath>
      </text>
      {/* open book at center */}
      <g
        stroke={variant === "foil" ? `url(#${id}-gold)` : "currentColor"}
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M 42,55 Q 51,50 60,55 Q 69,50 78,55 L 78,68 Q 69,63 60,68 Q 51,63 42,68 Z" />
        <line x1="60" y1="55" x2="60" y2="68" />
      </g>
      <text
        x="60"
        y="80.5"
        textAnchor="middle"
        fontSize="7"
        fontFamily="Georgia, serif"
        letterSpacing="1.1"
        fill={variant === "foil" ? `url(#${id}-gold)` : "currentColor"}
      >
        EST. 2008
      </text>
    </svg>
  );
}

// Small warm inline illustrations for empty states — the education world's
// own props: a clipboard sign-in sheet and an award ribbon. Hand-drawn feel,
// palette-native colors, no external assets.

export function ClipboardIllustration({ size = 132 }: { size?: number }) {
  return (
    <svg viewBox="0 0 140 140" width={size} height={size} aria-hidden="true" focusable="false">
      <g transform="rotate(-4 70 70)">
        <rect x="34" y="22" width="72" height="96" rx="7" fill="#c9a24d" opacity="0.28" />
        <rect x="30" y="18" width="72" height="96" rx="7" fill="#fff" stroke="#10233b" strokeWidth="2.4" />
        <rect x="52" y="10" width="28" height="14" rx="5" fill="#dde4ec" stroke="#10233b" strokeWidth="2.2" />
        <circle cx="66" cy="17" r="2.6" fill="#10233b" />
        <line x1="42" y1="42" x2="90" y2="42" stroke="#b9c6d6" strokeWidth="2.6" strokeLinecap="round" />
        <line x1="42" y1="56" x2="90" y2="56" stroke="#b9c6d6" strokeWidth="2.6" strokeLinecap="round" />
        <line x1="42" y1="70" x2="76" y2="70" stroke="#b9c6d6" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M 42,89 l 6,7 l 12,-13" fill="none" stroke="#0e7a50" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <g transform="rotate(32 108 96)">
        <rect x="102" y="62" width="9" height="52" rx="2" fill="#e6c878" stroke="#10233b" strokeWidth="2" />
        <polygon points="102,114 111,114 106.5,126" fill="#f4d9a8" stroke="#10233b" strokeWidth="2" strokeLinejoin="round" />
        <rect x="102" y="62" width="9" height="8" fill="#b03a3a" stroke="#10233b" strokeWidth="2" />
      </g>
    </svg>
  );
}

export function RibbonIllustration({ size = 108 }: { size?: number }) {
  return (
    <svg viewBox="0 0 120 130" width={size} height={size * (130 / 120)} aria-hidden="true" focusable="false">
      <g transform="rotate(3 60 60)">
        <polygon points="45,74 37,122 60,106 83,122 75,74" fill="#2757c4" opacity="0.85" stroke="#10233b" strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx="60" cy="52" r="34" fill="#e6c878" stroke="#10233b" strokeWidth="2.6" />
        <circle cx="60" cy="52" r="25" fill="#f4d9a8" stroke="#a37c2a" strokeWidth="1.6" strokeDasharray="2.5 2.5" />
        <path d="M 48,52 l 8,9 l 16,-18" fill="none" stroke="#0e7a50" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

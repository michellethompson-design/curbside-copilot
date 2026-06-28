// Inline icon set — stroke icons, currentColor, decorative by default (aria-hidden).
// Keeping them inline avoids an icon dependency and keeps full control of a11y.

import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: P & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const Icon = {
  Mic: (p: P) => (<Base {...p}><path d="M12 2a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10a7 7 0 0 1-14 0M12 17v5M8 22h8" /></Base>),
  Sparkles: (p: P) => (<Base {...p}><path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3Z" /><path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z" /></Base>),
  Calendar: (p: P) => (<Base {...p}><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></Base>),
  Users: (p: P) => (<Base {...p}><circle cx="9" cy="8" r="3.2" /><path d="M3 20a6 6 0 0 1 12 0M16 5.2a3.2 3.2 0 0 1 0 6M17 20a6 6 0 0 0-2-4.5" /></Base>),
  Check: (p: P) => (<Base {...p}><path d="M5 12.5l4.5 4.5L19 7" /></Base>),
  CheckCircle: (p: P) => (<Base {...p}><circle cx="12" cy="12" r="9" /><path d="M8.5 12.5l2.5 2.5 4.5-5" /></Base>),
  Award: (p: P) => (<Base {...p}><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5L7 22l5-3 5 3-1.5-8.5" /></Base>),
  ClipboardCheck: (p: P) => (<Base {...p}><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V3h6v1M9 13l2 2 4-4" /><path d="M9 4a1 1 0 0 0-1 1v1h8V5a1 1 0 0 0-1-1" /></Base>),
  Grid: (p: P) => (<Base {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Base>),
  Chart: (p: P) => (<Base {...p}><path d="M4 20V4M20 20H4" /><rect x="7" y="11" width="3" height="6" rx="0.5" /><rect x="12.5" y="7" width="3" height="10" rx="0.5" /><rect x="18" y="13" width="0.1" height="4" /></Base>),
  History: (p: P) => (<Base {...p}><path d="M3 12a9 9 0 1 0 3-6.7M3 5v3h3" /><path d="M12 8v4l3 2" /></Base>),
  Arrow: (p: P) => (<Base {...p}><path d="M5 12h14M13 6l6 6-6 6" /></Base>),
  ArrowLeft: (p: P) => (<Base {...p}><path d="M19 12H5M11 6l-6 6 6 6" /></Base>),
  Download: (p: P) => (<Base {...p}><path d="M12 3v12M7 11l5 5 5-5M5 21h14" /></Base>),
  Print: (p: P) => (<Base {...p}><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" rx="1" /></Base>),
  Settings: (p: P) => (<Base {...p}><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /></Base>),
  Accessibility: (p: P) => (<Base {...p}><circle cx="12" cy="4" r="1.6" /><path d="M5 8h14M12 8v6M12 14l-3 6M12 14l3 6" /></Base>),
  Eye: (p: P) => (<Base {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></Base>),
  Focus: (p: P) => (<Base {...p}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><circle cx="12" cy="12" r="2.5" /></Base>),
  Menu: (p: P) => (<Base {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Base>),
  Close: (p: P) => (<Base {...p}><path d="M6 6l12 12M18 6 6 18" /></Base>),
  Plus: (p: P) => (<Base {...p}><path d="M12 5v14M5 12h14" /></Base>),
  Alert: (p: P) => (<Base {...p}><path d="M12 3l9 16H3l9-16Z" /><path d="M12 10v4M12 17h.01" /></Base>),
  Copy: (p: P) => (<Base {...p}><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></Base>),
  Clock: (p: P) => (<Base {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Base>),
  Pin: (p: P) => (<Base {...p}><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" /><circle cx="12" cy="10" r="2.5" /></Base>),
  Mail: (p: P) => (<Base {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></Base>),
  Plug: (p: P) => (<Base {...p}><path d="M9 2v6M15 2v6M7 8h10v3a5 5 0 0 1-10 0V8ZM12 16v6" /></Base>),
  Save: (p: P) => (<Base {...p}><path d="M5 3h12l4 4v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" /><path d="M8 3v5h8M8 21v-7h8v7" /></Base>),
  Star: (p: P) => (<Base {...p}><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6L12 17.8 6.6 19.6l1-6L3.3 9.4l6-.9L12 3Z" /></Base>),
  Building: (p: P) => (<Base {...p}><rect x="4" y="3" width="16" height="18" rx="1.5" /><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3" /></Base>),
  Search: (p: P) => (<Base {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></Base>),
  Lightning: (p: P) => (<Base {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8Z" /></Base>),
  Shield: (p: P) => (<Base {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" /><path d="M9 12l2 2 4-4" /></Base>),
};

export type IconName = keyof typeof Icon;

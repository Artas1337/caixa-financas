export function Logo() {
  return (
    <span className="logo">
      <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
        <defs>
          <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ff3b62" />
            <stop offset="1" stopColor="#c80f32" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-grad)" />
        <rect x="8" y="17" width="4" height="7" rx="1.5" fill="#fff" />
        <rect x="14" y="12" width="4" height="12" rx="1.5" fill="#fff" />
        <rect x="20" y="8" width="4" height="16" rx="1.5" fill="#fff" />
      </svg>
      Caixa
    </span>
  );
}

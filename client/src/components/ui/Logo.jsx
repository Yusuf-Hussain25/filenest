import { useId } from 'react'

// Filenest mark: a folder resting in a nest, on a sky-to-slate tile.
export const LogoMark = ({ size = 32 }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-g`} x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7DD3FC" />
          <stop offset=".5" stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#334155" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9.5" fill={`url(#${id}-g)`} />
      <path d="M9.2 8.6h4.1l1.9 2.1h7.6a1.9 1.9 0 0 1 1.9 1.9v5.6H7.3v-7.7a1.9 1.9 0 0 1 1.9-1.9z" fill="#fff" />
      <path d="M5.6 16.6c1.9 5.3 5.7 8.3 10.4 8.3s8.5-3 10.4-8.3" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M9.8 21.3h12.4" stroke="#fff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
};

const Logo = ({ size = 32, showText = true, className = '' }) => (
  <span className={`inline-flex items-center gap-2.5 ${className}`}>
    <LogoMark size={size} />
    {showText && (
      <span className="font-semibold text-fg" style={{ fontSize: size * 0.62, letterSpacing: '-0.035em' }}>
        Filenest
      </span>
    )}
  </span>
);

export default Logo

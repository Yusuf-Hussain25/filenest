import { useId } from 'react'
import { extensionOf, fileKind } from '../../lib/files'

// Rounded tile with the file type's icon and color.
export const FileGlyph = ({ mime, name = '', size = 40, showExt = false, className = '' }) => {
  const kind = fileKind(mime);
  const Icon = kind.icon;
  const ext = showExt ? extensionOf(name) : '';
  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center ${className}`}
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.3),
        background: `linear-gradient(145deg, ${kind.from}33, ${kind.to}29)`,
        color: kind.to,
        boxShadow: `inset 0 0 0 1px ${kind.to}26`,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.48)} strokeWidth={1.8} />
      {ext && (
        <span
          className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-md px-1.5 font-mono text-[9.5px] leading-[16px] font-semibold text-white"
          style={{ background: kind.to }}
        >
          {ext}
        </span>
      )}
    </span>
  );
};

// Folder in the brand gradient (two-tone: back flap and front).
export const FolderGlyph = ({ size = 40, className = '', open = false }) => {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" className={`shrink-0 ${className}`} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-f`} x1="4" y1="10" x2="36" y2="36" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7DD3FC" />
          <stop offset=".55" stopColor="#0EA5E9" />
          <stop offset="1" stopColor="#0369A1" />
        </linearGradient>
      </defs>
      <path d="M4 11.5A3.5 3.5 0 0 1 7.5 8h7.4a3.5 3.5 0 0 1 2.5 1l1.9 2h13.2A3.5 3.5 0 0 1 36 14.5V30a3.5 3.5 0 0 1-3.5 3.5h-25A3.5 3.5 0 0 1 4 30z" fill="#0369A1" opacity=".55" />
      <path
        d={open ? 'M6.8 16.5A3 3 0 0 1 9.7 14H35a2 2 0 0 1 1.9 2.6l-3.6 14.5a3.2 3.2 0 0 1-3.1 2.4H7.5A3.5 3.5 0 0 1 4 30l2.8-13.5z' : 'M4 16a3 3 0 0 1 3-3h26a3 3 0 0 1 3 3v14a3.5 3.5 0 0 1-3.5 3.5h-25A3.5 3.5 0 0 1 4 30z'}
        fill={`url(#${id}-f)`}
      />
      <path d="M8 17.5h24" stroke="#fff" strokeOpacity=".35" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
};

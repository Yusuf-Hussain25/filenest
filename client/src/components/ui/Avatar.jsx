import { useState } from 'react'
import { gradientFor, initialsOf } from '../../lib/avatar'

// Profile picture with an initials fallback and an optional presence dot.
const Avatar = ({ src, name = '', size = 40, online = false, className = '' }) => {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;

  return (
    <span
      className={`relative inline-grid shrink-0 place-items-center rounded-full ${className}`}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {showImage
        ? <img src={src} alt={name} onError={() => setFailed(true)} loading="lazy" className="size-full rounded-full object-cover" />
        : (
          <span
            className="grid size-full place-items-center rounded-full font-semibold text-white select-none"
            style={{ background: gradientFor(name), letterSpacing: '-0.02em' }}
            role="img"
            aria-label={name || 'User'}
          >
            {initialsOf(name)}
          </span>
        )}
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-bg bg-ok"
          style={{ width: Math.max(10, size * 0.26), height: Math.max(10, size * 0.26) }}
        />
      )}
    </span>
  );
};

export default Avatar

import { CATEGORIES } from '../../lib/files'
import { formatBytes } from '../../lib/format'

// "412 MB of 1 GB" with a bar split by file category
const StorageMeter = ({ used = 0, limit = 1, categories = [], compact = false }) => {
  const pct = Math.min(100, (used / limit) * 100);
  const known = categories.reduce((n, c) => n + c.size, 0);
  const tone = pct >= 95 ? 'text-danger' : pct >= 80 ? 'text-warn' : 'text-fg-2';
  return (
    <div>
      <p className={`text-[12.5px] font-medium ${tone}`}>
        <span className="text-fg">{formatBytes(used)}</span> of {formatBytes(limit)} used
      </p>
      <div
        className="mt-2 flex h-2 overflow-hidden rounded-full bg-surface-3"
        role="meter"
        aria-label="Storage used"
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-valuenow={used}
        aria-valuetext={`${formatBytes(used)} of ${formatBytes(limit)}`}
      >
        {categories.length && known ? (
          [...categories].sort((a, b) => b.size - a.size).map((c) => (
            <span
              key={c.key}
              className="h-full animate-[fill-bar_.8s_var(--ease-out)_both] first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(c.size / limit) * 100}%`, minWidth: c.size ? 3 : 0, background: CATEGORIES[c.key]?.color }}
              title={`${CATEGORIES[c.key]?.label}: ${formatBytes(c.size)}`}
            />
          ))
        ) : (
          <span className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        )}
      </div>
      {!compact && categories.length > 0 && (
        <ul className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1">
          {[...categories].sort((a, b) => b.size - a.size).slice(0, 3).map((c) => (
            <li key={c.key} className="flex items-center gap-1.5 text-[11px] text-fg-3">
              <span className="size-2 rounded-full" style={{ background: CATEGORIES[c.key]?.color }} />
              {CATEGORIES[c.key]?.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default StorageMeter

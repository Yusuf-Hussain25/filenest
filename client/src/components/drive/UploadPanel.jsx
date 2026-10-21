import { useState } from 'react'
import { ChevronDownIcon, CircleCheckIcon, CircleXIcon, RotateCcwIcon, UploadCloudIcon, XIcon } from 'lucide-react'
import { useUploads } from '../../context/UploadContext'
import { FileGlyph } from '../ui/FileGlyph'
import { formatBytes } from '../../lib/format'

// Live upload list in the corner: per-file progress, cancel, retry, and a summary when done.
const UploadPanel = () => {
  const { uploads, busy, cancel, retry, clearFinished } = useUploads();
  const [collapsed, setCollapsed] = useState(false);

  if (!uploads.length) return null;

  const done = uploads.filter((u) => u.status === 'done').length;
  const failed = uploads.filter((u) => u.status === 'error').length;
  const totalBytes = uploads.reduce((n, u) => n + (u.status === 'canceled' ? 0 : u.size), 0);
  const sentBytes = uploads.reduce((n, u) => n + (u.status === 'canceled' ? 0 : (u.size * u.progress) / 100), 0);
  const overall = totalBytes ? Math.round((sentBytes / totalBytes) * 100) : 100;
  const title = busy
    ? `Uploading ${uploads.filter((u) => u.status === 'uploading' || u.status === 'queued').length} of ${uploads.length}`
    : failed ? `${done} uploaded, ${failed} failed` : `${done} ${done === 1 ? 'upload' : 'uploads'} complete`;

  return (
    <section
      className="glass fixed right-3 bottom-[calc(9.75rem+env(safe-area-inset-bottom))] z-50 w-[calc(100%-1.5rem)] max-w-sm overflow-hidden rounded-[22px] shadow-deep animate-fade-up sm:right-5 lg:bottom-5"
      aria-label="Uploads"
    >
      <header className="flex items-center gap-3 px-4 py-3">
        <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${failed && !busy ? 'bg-danger/12 text-danger' : 'bg-accent-soft text-accent-text'}`}>
          {busy ? <UploadCloudIcon size={18} /> : failed ? <CircleXIcon size={18} /> : <CircleCheckIcon size={18} />}
        </span>
        <div className="min-w-0 flex-1" aria-live="polite">
          <p className="truncate text-sm font-semibold">{title}</p>
          <p className="text-xs text-fg-3">{busy ? `${overall}% · ${formatBytes(sentBytes)} of ${formatBytes(totalBytes)}` : `to ${uploads[uploads.length - 1].folderName}`}</p>
        </div>
        <button className="icon-btn icon-btn-sm" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? 'Show uploads' : 'Hide upload list'} aria-expanded={!collapsed}>
          <ChevronDownIcon size={17} className={`transition-transform ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        {!busy && (
          <button className="icon-btn icon-btn-sm" onClick={clearFinished} aria-label="Close uploads">
            <XIcon size={17} />
          </button>
        )}
      </header>
      {busy && <div className="progress mx-4 mb-3 !h-1"><span style={{ width: `${overall}%` }} /></div>}

      {!collapsed && (
        <ul className="max-h-64 overflow-y-auto border-t border-line px-2 py-2">
          {uploads.map((u) => (
            <li key={u.id} className="flex items-center gap-3 rounded-xl px-2 py-2">
              <FileGlyph mime={u.type} size={32} />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-[13px] font-medium ${u.status === 'canceled' ? 'text-fg-3 line-through' : ''}`} title={u.path}>{u.name}</p>
                {u.path !== u.name && u.status !== 'error' && <p className="truncate text-[11px] text-fg-3">{u.path.split('/').slice(0, -1).join(' / ')}</p>}
                {u.status === 'uploading' || u.status === 'queued' ? (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="progress flex-1 !h-1.5"><span style={{ width: `${u.progress}%` }} /></div>
                    <span className="w-9 text-right text-[11px] text-fg-3 tabular-nums">{u.status === 'queued' ? 'Wait' : `${u.progress}%`}</span>
                  </div>
                ) : u.status === 'error' ? (
                  <p className="truncate text-xs text-danger" title={u.error}>{u.error}</p>
                ) : (
                  <p className="text-xs text-fg-3">{u.status === 'canceled' ? 'Canceled' : formatBytes(u.size)}</p>
                )}
              </div>
              {(u.status === 'uploading' || u.status === 'queued') && (
                <button className="icon-btn icon-btn-sm" onClick={() => cancel(u.id)} aria-label={`Cancel ${u.name}`}><XIcon size={15} /></button>
              )}
              {u.status === 'error' && (
                <button className="icon-btn icon-btn-sm" onClick={() => retry(u.id)} aria-label={`Retry ${u.name}`} data-tip="Retry"><RotateCcwIcon size={15} /></button>
              )}
              {u.status === 'done' && <CircleCheckIcon size={18} className="mr-2 text-ok" aria-label="Uploaded" />}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

export default UploadPanel

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react'
import { FileGlyph } from '../ui/FileGlyph'
import { fileKind } from '../../lib/files'
import { formatBytes } from '../../lib/format'

// Full-screen viewer frame: top bar, the file, prev/next, and an optional side panel.
// Keyboard: Esc closes, ←/→ move between files.
const FileViewer = ({ file, children, actions, side, onClose, onPrev, onNext, position }) => {
  const rootRef = useRef(null);
  const handlers = useRef({ onClose, onPrev, onNext });
  const touchX = useRef(0);

  useEffect(() => {
    handlers.current = { onClose, onPrev, onNext };
  });

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    rootRef.current?.focus();
    const onKey = (e) => {
      // Dialogs opened on top of the viewer handle their own keys
      if (document.querySelector('[role=dialog][aria-modal=true]:not([data-viewer])') || document.querySelector('[role=menu]')) return;
      if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      if (e.key === 'Escape') handlers.current.onClose();
      if (e.key === 'ArrowLeft') handlers.current.onPrev?.();
      if (e.key === 'ArrowRight') handlers.current.onNext?.();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, []);

  return createPortal(
    <div
      ref={rootRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      data-viewer
      data-theme="dark"
      aria-label={`Preview of ${file.name}`}
      className="fixed inset-0 z-[95] flex flex-col bg-[#05080d]/95 text-white outline-none backdrop-blur-xl animate-fade-in"
    >
      {/* Top bar */}
      <header className="flex h-16 shrink-0 items-center gap-3 px-3 sm:px-5">
        <button className="icon-btn !text-white/80 hover:!bg-white/10 hover:!text-white" onClick={onClose} aria-label="Close preview" data-tip="Close (Esc)" data-tip-pos="bottom">
          <XIcon size={20} />
        </button>
        <FileGlyph mime={file.mime_type} size={32} className="hidden sm:inline-grid" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{file.name}</p>
          <p className="truncate text-xs text-white/55">
            {fileKind(file.mime_type).label} · {formatBytes(file.size)}{position && position.total > 1 ? ` · ${position.index + 1} of ${position.total}` : ''}
          </p>
        </div>
        <div className="hidden items-center gap-1 sm:flex">{actions}</div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Stage */}
        <div
          className="relative flex min-w-0 flex-1 items-center justify-center px-3 pb-4 sm:px-16 sm:pb-8"
          onTouchStart={(e) => { touchX.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchX.current;
            if (Math.abs(dx) > 60) (dx > 0 ? onPrev : onNext)?.();
          }}
        >
          {children}
          {onPrev && (
            <button className="absolute top-1/2 left-2 hidden size-11 -translate-y-1/2 place-items-center sm:grid rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:left-4" onClick={onPrev} aria-label="Previous file">
              <ChevronLeftIcon size={22} />
            </button>
          )}
          {onNext && (
            <button className="absolute top-1/2 right-2 hidden size-11 -translate-y-1/2 place-items-center sm:grid rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/20 sm:right-4" onClick={onNext} aria-label="Next file">
              <ChevronRightIcon size={22} />
            </button>
          )}
        </div>
        {side}
      </div>

      {/* Phones: actions in a bottom bar, so the name gets the top bar */}
      <footer className="flex h-16 shrink-0 items-center justify-around border-t border-white/10 px-2 pb-[env(safe-area-inset-bottom)] sm:hidden">{actions}</footer>
    </div>,
    document.body
  );
};

export default FileViewer

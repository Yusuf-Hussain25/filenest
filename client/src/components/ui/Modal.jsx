import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { XIcon } from 'lucide-react'

// Accessible dialog: closes on Escape and backdrop click, focuses itself, locks page scroll.
// On phones it slides up as a bottom sheet.
const Modal = ({ open, onClose, title, subtitle, icon, children, footer, size = 'md' }) => {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    const prevFocus = document.activeElement;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
      }
    };
    window.addEventListener('keydown', onKey);
    // Focus the first field if there is one, otherwise the dialog
    const field = panelRef.current?.querySelector('[data-autofocus], input:not([type=hidden]):not([readonly]), select, textarea');
    (field || panelRef.current)?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
      prevFocus?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const width = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }[size] || 'max-w-xl';

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      <div
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={`relative flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-t-[28px] border border-line bg-panel-solid shadow-deep outline-none animate-pop-in sm:rounded-[28px]`}
      >
        {(title || icon) && (
          <header className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
            {icon && <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text">{icon}</span>}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[17px] font-semibold tracking-tight">{title}</h2>
              {subtitle && <p className="mt-0.5 truncate text-[13px] text-fg-3">{subtitle}</p>}
            </div>
            <button className="icon-btn -mr-2" onClick={onClose} aria-label="Close dialog">
              <XIcon size={18} />
            </button>
          </header>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        {footer && <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6">{footer}</footer>}
      </div>
    </div>,
    document.body
  );
};

export default Modal

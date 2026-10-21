import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// Floating menu at a point ({ x, y }, e.g. a right-click) or under an element.
// items: [{ label, icon: Icon, onClick, danger, disabled, hint }] and { separator: true }
// Keyboard: arrows move, Enter/Space choose, Escape and Tab close.
export const MenuPopover = ({ open, anchor, align = 'end', items, onClose, label = 'Actions' }) => {
  const panelRef = useRef(null);
  const [pos, setPos] = useState(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Position inside the viewport, flipping above the anchor when there's no room below
  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) return;
    const { width, height } = panelRef.current.getBoundingClientRect();
    const rect = anchor instanceof Element ? anchor.getBoundingClientRect() : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect ? (align === 'end' ? rect.right - width : rect.left) : anchor.x;
    let top = rect ? rect.bottom + 6 : anchor.y;
    if (top + height > vh - 8) top = rect ? rect.top - height - 6 : anchor.y - height;
    left = Math.min(Math.max(8, left), vw - width - 8);
    top = Math.min(Math.max(8, top), vh - height - 8);
    setPos({ left, top });
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const first = panelRef.current?.querySelector('[role=menuitem]:not(:disabled)');
    first?.focus();
    const onDown = (e) => {
      // The trigger toggles itself; anything else outside the panel closes it
      if (panelRef.current?.contains(e.target) || (anchor instanceof Element && anchor.contains(e.target))) return;
      onCloseRef.current?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape' || e.key === 'Tab') {
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current?.({ restoreFocus: true });
      }
    };
    const onScroll = () => onCloseRef.current?.();
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onScroll);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onScroll);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open, anchor]);

  if (!open) return null;

  const onItemsKey = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Home' && e.key !== 'End') return;
    e.preventDefault();
    const nodes = [...panelRef.current.querySelectorAll('[role=menuitem]:not(:disabled)')];
    const i = nodes.indexOf(document.activeElement);
    const next =
      e.key === 'Home' ? 0 :
      e.key === 'End' ? nodes.length - 1 :
      e.key === 'ArrowDown' ? (i + 1) % nodes.length : (i - 1 + nodes.length) % nodes.length;
    nodes[next]?.focus();
  };

  return createPortal(
    <div
      ref={panelRef}
      role="menu"
      aria-label={label}
      onKeyDown={onItemsKey}
      onContextMenu={(e) => e.preventDefault()}
      className="menu fixed z-[120] animate-pop-in"
      style={pos ? { left: pos.left, top: pos.top } : { left: -9999, top: -9999 }}
    >
      {items.filter(Boolean).map((item, i) =>
        item.separator ? (
          <div key={`sep-${i}`} className="menu-sep" role="separator" />
        ) : (
          <button
            key={item.label}
            role="menuitem"
            type="button"
            className={`menu-item ${item.danger ? 'danger' : ''}`}
            disabled={item.disabled}
            onClick={() => {
              onClose?.();
              item.onClick?.();
            }}
          >
            {item.icon && <item.icon size={16} />}
            <span className="flex-1 truncate">{item.label}</span>
            {item.hint && <span className="text-xs text-fg-3">{item.hint}</span>}
          </button>
        )
      )}
    </div>,
    document.body
  );
};

// Button that opens a menu. `children` renders the trigger: ({ ref, onClick, ...aria }) => <button .../>
const Menu = ({ items, children, align = 'end', label }) => {
  const [anchor, setAnchor] = useState(null);

  return (
    <>
      {children({
        onClick: (e) => {
          e.stopPropagation();
          const el = e.currentTarget;
          setAnchor((current) => (current ? null : el));
        },
        'aria-haspopup': 'menu',
        'aria-expanded': Boolean(anchor),
      })}
      <MenuPopover
        open={Boolean(anchor)}
        anchor={anchor}
        align={align}
        items={items}
        label={label}
        onClose={(opts) => {
          if (opts?.restoreFocus) anchor?.focus();
          setAnchor(null);
        }}
      />
    </>
  );
};

export default Menu

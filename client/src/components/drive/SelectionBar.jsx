import { useState } from 'react'
import { createPortal } from 'react-dom'
import { CheckCheckIcon, DownloadIcon, FolderInputIcon, StarIcon, StarOffIcon, Trash2Icon, XIcon } from 'lucide-react'
import { useActions } from '../../context/ActionsContext'
import { pluralize } from '../../lib/format'

// Actions for the current multi-selection: a floating bar at the bottom on desktop, and a bar
// over the top of the screen on phones (where the tab bar and + button live at the bottom).
const SelectionBar = ({ selection, total }) => {
  const actions = useActions();
  const [busy, setBusy] = useState(null);
  if (!selection.active) return null;

  const items = selection.selected;
  const allStarred = items.every((i) => i.is_starred);
  const run = async (key, fn) => {
    setBusy(key);
    const ok = await fn();
    setBusy(null);
    if (ok !== false && key !== 'download') selection.clear();
  };

  const buttons = [
    { key: 'download', label: items.length === 1 ? 'Download' : 'Download ZIP', icon: DownloadIcon, onClick: () => run('download', () => actions.downloadMany(items)) },
    { key: 'move', label: 'Move', icon: FolderInputIcon, onClick: () => actions.moveMany(items) },
    { key: 'star', label: allStarred ? 'Unstar' : 'Star', icon: allStarred ? StarOffIcon : StarIcon, onClick: () => run('star', () => actions.starMany(items, !allStarred)) },
    { key: 'trash', label: 'Trash', icon: Trash2Icon, danger: true, onClick: () => run('trash', () => actions.trashMany(items)) },
  ];

  return createPortal(
    <div
      role="toolbar"
      aria-label={`${pluralize(items.length, 'item')} selected`}
      className="glass fixed inset-x-3 top-3 z-[60] flex h-14 items-center gap-1 rounded-[20px] px-2 shadow-deep animate-fade-up lg:inset-x-auto lg:top-auto lg:bottom-6 lg:left-1/2 lg:h-14 lg:-translate-x-1/2 lg:gap-1.5 lg:rounded-full lg:pr-2 lg:pl-3"
    >
      <button className="icon-btn icon-btn-sm" onClick={selection.clear} aria-label="Clear selection" data-tip="Clear (Esc)">
        <XIcon size={17} />
      </button>
      <p className="mr-auto pr-2 text-sm font-semibold tabular-nums lg:mr-2">{items.length} selected</p>
      {items.length < total && (
        <button className="icon-btn icon-btn-sm" onClick={selection.selectAll} aria-label="Select all" data-tip="Select all">
          <CheckCheckIcon size={17} />
        </button>
      )}
      <span className="mx-1 hidden h-6 w-px bg-line lg:block" />
      {buttons.map(({ key, label, icon: Icon, onClick, danger }) => (
        <button
          key={key}
          className={`flex h-10 items-center gap-2 rounded-full px-2.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-50 lg:px-3.5 ${danger ? 'text-danger' : ''}`}
          onClick={onClick}
          disabled={Boolean(busy)}
          aria-label={label}
        >
          {busy === key ? <span className="spinner size-4" /> : <Icon size={17} />}
          <span className="hidden lg:inline">{label}</span>
        </button>
      ))}
    </div>,
    document.body
  );
};

export default SelectionBar

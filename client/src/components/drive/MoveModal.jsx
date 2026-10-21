import { useMemo, useState } from 'react'
import { ChevronRightIcon, FolderInputIcon, HardDriveIcon } from 'lucide-react'
import Modal from '../ui/Modal'
import { FolderGlyph } from '../ui/FileGlyph'
import api from '../../config/api'
import { useDriveData } from '../../hooks/useDriveData'
import { isFolder } from '../../lib/files'

// "Move to" picker: the whole folder tree, with the item itself and its subfolders disabled.
const MoveModal = ({ item, onClose, onMove }) => {
  const folderItem = isFolder(item);
  const currentParent = (folderItem ? item.parent_id : item.folder_id) ?? null;
  const { data, loading, error } = useDriveData(() => api.get('/api/drive/folders').then((r) => r.data.folders), 'move-tree');
  const [target, setTarget] = useState(currentParent);
  const [expanded, setExpanded] = useState(() => new Set());
  const [busy, setBusy] = useState(false);

  const { children, blocked } = useMemo(() => {
    const byParent = new Map();
    const blockedIds = new Set();
    (data || []).forEach((f) => {
      const key = f.parent_id ?? 'root';
      if (!byParent.has(key)) byParent.set(key, []);
      byParent.get(key).push(f);
      if (folderItem && (f.id === item.id || f.path?.includes(item.id))) blockedIds.add(f.id);
    });
    return { children: byParent, blocked: blockedIds };
  }, [data, folderItem, item.id]);

  // Open the branch that holds the current location
  const [didExpand, setDidExpand] = useState(false);
  if (data && !didExpand) {
    setDidExpand(true);
    const current = data.find((f) => f.id === currentParent);
    if (current) setExpanded(new Set([...(current.path || []), current.id]));
  }

  const toggle = (id) => setExpanded((s) => {
    const next = new Set(s);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const move = async () => {
    setBusy(true);
    const ok = await onMove(item, target);
    setBusy(false);
    if (ok) onClose();
  };

  const renderRow = (folder, depth) => {
    const kids = children.get(folder.id) || [];
    const isOpen = expanded.has(folder.id);
    const disabled = blocked.has(folder.id);
    const selected = target === folder.id;
    return (
      <li key={folder.id}>
        <div
          className={`flex h-10 items-center gap-1 rounded-xl pr-2 transition-colors ${selected ? 'bg-accent-soft' : disabled ? 'opacity-45' : 'hover:bg-surface-2'}`}
          style={{ paddingLeft: 6 + depth * 18 }}
        >
          <button
            type="button"
            className={`icon-btn icon-btn-sm !size-7 ${kids.length ? '' : 'invisible'}`}
            onClick={() => toggle(folder.id)}
            aria-label={`${isOpen ? 'Collapse' : 'Expand'} ${folder.name}`}
            aria-expanded={isOpen}
          >
            <ChevronRightIcon size={15} className={`transition-transform ${isOpen ? 'rotate-90' : ''}`} />
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => setTarget(folder.id)}
            onDoubleClick={() => toggle(folder.id)}
            className="flex min-w-0 flex-1 items-center gap-2.5 text-left text-sm"
            aria-pressed={selected}
          >
            <FolderGlyph size={22} open={isOpen} />
            <span className={`truncate ${selected ? 'font-semibold text-accent-text' : ''}`}>{folder.name}</span>
            {folder.id === currentParent && <span className="chip ml-auto !h-5 !text-[10.5px]">Current</span>}
          </button>
        </div>
        {isOpen && kids.length > 0 && (
          <ul>{kids.map((k) => renderRow(k, depth + 1))}</ul>
        )}
      </li>
    );
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={`Move "${item.name}"`}
      subtitle="Choose a destination folder"
      icon={<FolderInputIcon size={19} />}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={move} disabled={busy || loading || target === currentParent}>
            {busy && <span className="spinner size-4" />}
            Move here
          </button>
        </>
      }
    >
      <div className="max-h-[52vh] overflow-y-auto px-3 py-3 sm:px-4">
        <button
          type="button"
          onClick={() => setTarget(null)}
          aria-pressed={target === null}
          className={`flex h-10 w-full items-center gap-2.5 rounded-xl px-3 text-left text-sm transition-colors ${target === null ? 'bg-accent-soft font-semibold text-accent-text' : 'hover:bg-surface-2'}`}
        >
          <HardDriveIcon size={18} /> My Files
          {currentParent === null && <span className="chip ml-auto !h-5 !text-[10.5px] font-normal">Current</span>}
        </button>
        {loading ? (
          <div className="mt-2 space-y-2 px-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-8" style={{ marginLeft: (i % 2) * 18 }} />)}</div>
        ) : error ? (
          <p className="px-3 py-6 text-center text-sm text-danger">Couldn't load your folders. Close and try again.</p>
        ) : (
          <ul className="mt-1">{(children.get('root') || []).map((f) => renderRow(f, 0))}</ul>
        )}
      </div>
    </Modal>
  );
};

export default MoveModal

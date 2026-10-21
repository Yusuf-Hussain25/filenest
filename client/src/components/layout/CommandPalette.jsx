import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { CornerDownLeftIcon, FolderPlusIcon, SearchIcon, UploadIcon } from 'lucide-react'
import api from '../../config/api'
import { useActions } from '../../context/ActionsContext'
import { useWorkspace } from '../../context/WorkspaceContext'
import { FileGlyph, FolderGlyph } from '../ui/FileGlyph'
import { NAV } from './nav'
import { formatBytes } from '../../lib/format'

// ⌘K: search every file and folder by name, or jump to a section / quick action.
const CommandPalette = ({ open, onClose }) => {
  const navigate = useNavigate();
  const actions = useActions();
  const { here, pickFiles } = useWorkspace();
  const [query, setQuery] = useState('');
  const [found, setFound] = useState({ q: '', folders: [], files: [] });
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const term = query.trim();

  // Debounced search; results for an older query are ignored
  useEffect(() => {
    if (!term) return;
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get('/api/drive/search', { params: { q: term } });
        if (alive) setFound({ q: term, folders: data.folders, files: data.files });
      } catch {
        if (alive) setFound({ q: term, folders: [], files: [] });
      } finally {
        if (alive) setSearching(false);
      }
    }, 180);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [term]);

  const entries = useMemo(() => {
    if (!term) {
      return [
        { id: 'upload', group: 'Actions', icon: <UploadIcon size={17} />, label: 'Upload files', hint: here.id ? `to ${here.name}` : undefined, run: pickFiles },
        { id: 'folder', group: 'Actions', icon: <FolderPlusIcon size={17} />, label: 'New folder', hint: here.id ? `in ${here.name}` : undefined, run: () => actions.newFolder(here.id, here.name) },
        ...NAV.map((n) => ({ id: n.to, group: 'Go to', icon: <n.icon size={17} />, label: n.label, run: () => navigate(n.to) })),
      ];
    }
    if (found.q !== term) return [];
    return [
      ...found.folders.map((f) => ({ id: f.id, group: 'Folders', icon: <FolderGlyph size={26} />, label: f.name, hint: `in ${f.folder_name || 'My Files'}`, run: () => navigate(`/folder/${f.id}`) })),
      ...found.files.map((f) => ({ id: f.id, group: 'Files', icon: <FileGlyph mime={f.mime_type} size={26} />, label: f.name, hint: `${f.folder_name || 'My Files'} · ${formatBytes(f.size)}`, run: () => actions.open(f, found.files) })),
    ];
  }, [term, found, here, pickFiles, actions, navigate]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    listRef.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const close = () => {
    setQuery('');
    setActive(0);
    onClose();
  };

  const choose = (entry) => {
    close();
    entry.run();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(entries.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && entries[active]) {
      e.preventDefault();
      choose(entries[active]);
    }
  };

  let lastGroup = null;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-start justify-center px-3 pt-[10vh]" role="presentation">
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm animate-fade-in" onClick={close} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-[24px] border border-line-strong bg-panel-solid shadow-deep animate-pop-in" role="dialog" aria-modal="true" aria-label="Search Filenest">
        <div className="flex items-center gap-3 border-b border-line px-4">
          {searching ? <span className="spinner size-[18px] text-fg-3" /> : <SearchIcon size={19} className="text-fg-3" />}
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search files and folders…"
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-fg-3"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-results"
            aria-activedescendant={entries[active] ? `palette-${entries[active].id}` : undefined}
            aria-autocomplete="list"
          />
          <span className="kbd hidden sm:inline-grid">Esc</span>
        </div>

        <ul ref={listRef} id="palette-results" role="listbox" className="max-h-[min(60vh,440px)] overflow-y-auto p-2">
          {entries.map((entry, i) => {
            const header = entry.group !== lastGroup ? entry.group : null;
            lastGroup = entry.group;
            return (
              <li key={`${entry.group}-${entry.id}`} role="presentation">
                {header && <p className="eyebrow px-3 pt-3 pb-1.5 !text-[11px]">{header}</p>}
                <div
                  id={`palette-${entry.id}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(entry)}
                  className={`flex h-12 cursor-pointer items-center gap-3 rounded-xl px-3 ${i === active ? 'bg-surface-2' : ''}`}
                >
                  <span className="grid w-7 shrink-0 place-items-center text-fg-2">{entry.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{entry.label}</span>
                    {entry.hint && <span className="block truncate text-xs text-fg-3">{entry.hint}</span>}
                  </span>
                  {i === active && <CornerDownLeftIcon size={15} className="text-fg-3" />}
                </div>
              </li>
            );
          })}
          {term && found.q === term && !entries.length && (
            <li className="px-4 py-10 text-center text-sm text-fg-3">No files or folders match “{term}”.</li>
          )}
          {term && found.q !== term && (
            <li className="space-y-2 p-2" aria-hidden="true">{[0, 1, 2].map((k) => <div key={k} className="skeleton h-10" />)}</li>
          )}
        </ul>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette

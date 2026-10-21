import { useState } from 'react'
import { EllipsisVerticalIcon, Link2Icon, PlayIcon, StarIcon } from 'lucide-react'
import Menu, { MenuPopover } from '../ui/Menu'
import { FileGlyph, FolderGlyph } from '../ui/FileGlyph'
import { useActions } from '../../context/ActionsContext'
import { formatBytes, formatDate, formatRelative, pluralize } from '../../lib/format'
import { fileKind } from '../../lib/files'

const folderMeta = (f) => {
  const parts = [];
  if (f.folder_count) parts.push(pluralize(f.folder_count, 'folder'));
  if (f.file_count) parts.push(pluralize(f.file_count, 'file'));
  if (!parts.length) return 'Empty';
  return `${parts.join(', ')}${Number(f.total_size) ? ` · ${formatBytes(f.total_size)}` : ''}`;
};

// Right-click and "⋯" menus for one item
const useItemMenu = (item, list) => {
  const actions = useActions();
  const [point, setPoint] = useState(null);
  const items = actions.menuFor(item, list);
  return {
    items,
    onContextMenu: (e) => {
      e.preventDefault();
      setPoint({ x: e.clientX, y: e.clientY });
    },
    popover: <MenuPopover open={Boolean(point)} anchor={point} items={items} onClose={() => setPoint(null)} label={`Actions for ${item.name}`} />,
  };
};

const MoreButton = ({ items, name, className = '' }) => (
  <Menu items={items} label={`Actions for ${name}`}>
    {(props) => (
      <button {...props} type="button" className={`icon-btn icon-btn-sm relative z-10 ${className}`} aria-label={`More actions for ${name}`}>
        <EllipsisVerticalIcon size={17} />
      </button>
    )}
  </Menu>
);

const Badges = ({ item, className = '' }) => (
  <>
    {item.is_starred && <StarIcon size={14} className={`shrink-0 fill-star text-star ${className}`} aria-label="Starred" />}
    {item.is_shared && <Link2Icon size={14} className={`shrink-0 text-accent-text ${className}`} aria-label="Shared with a link" />}
  </>
);

// The whole card opens the item; the ⋯ button sits above the stretched button.
export const FolderCard = ({ folder, list, showLocation }) => {
  const actions = useActions();
  const menu = useItemMenu(folder, list);
  return (
    <article className="tile group relative flex items-center gap-3 p-3 pr-2" onContextMenu={menu.onContextMenu}>
      <FolderGlyph size={40} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold">{folder.name}</span>
          <Badges item={folder} />
        </p>
        <p className="truncate text-xs text-fg-3">{showLocation ? `in ${folder.folder_name || 'My Files'}` : folderMeta(folder)}</p>
      </div>
      <button type="button" className="absolute inset-0 rounded-[inherit]" onClick={() => actions.open(folder)} aria-label={`Open folder ${folder.name}`} />
      <MoreButton items={menu.items} name={folder.name} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100" />
      {menu.popover}
    </article>
  );
};

export const FileCard = ({ file, list }) => {
  const actions = useActions();
  const menu = useItemMenu(file, list);
  const kind = fileKind(file.mime_type);
  const [imgFailed, setImgFailed] = useState(false);
  const showThumb = file.thumb_url && !imgFailed;
  return (
    <article className="tile group relative flex flex-col overflow-hidden" onContextMenu={menu.onContextMenu}>
      <div
        className="relative grid aspect-[4/3] place-items-center overflow-hidden border-b border-line"
        style={showThumb ? undefined : { background: `linear-gradient(145deg, ${kind.from}22, ${kind.to}14)` }}
      >
        {showThumb ? (
          <img src={file.thumb_url} alt="" loading="lazy" onError={() => setImgFailed(true)} className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <FileGlyph mime={file.mime_type} name={file.name} size={52} showExt />
        )}
        {kind.key === 'video' && (
          <span className="absolute grid size-10 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm"><PlayIcon size={17} className="ml-0.5 fill-white" /></span>
        )}
        {(file.is_starred || file.is_shared) && (
          <span className="glass absolute top-2 left-2 flex items-center gap-1 rounded-full px-1.5 py-1"><Badges item={file} /></span>
        )}
      </div>
      <div className="flex items-center gap-2 py-2.5 pr-1.5 pl-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13.5px] font-semibold" title={file.name}>{file.name}</p>
          <p className="truncate text-xs text-fg-3">
            {file.folder_name !== undefined ? `${file.folder_name || 'My Files'} · ` : ''}{formatBytes(file.size)} · {formatRelative(file.activity_at || file.created_at)}
          </p>
        </div>
        <MoreButton items={menu.items} name={file.name} className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100 sm:aria-expanded:opacity-100" />
      </div>
      <button type="button" className="absolute inset-0 rounded-[inherit]" onClick={() => actions.open(file, list)} aria-label={`Preview ${file.name}`} />
      {menu.popover}
    </article>
  );
};

// Row for list view (folders and files)
export const ItemRow = ({ item, list, isFolderItem, showLocation }) => {
  const actions = useActions();
  const menu = useItemMenu(item, list);
  const location = item.folder_name ?? null;
  return (
    <li className="group relative grid grid-cols-[1fr_auto] items-center gap-3 rounded-2xl px-3 py-2 transition-colors hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_140px_110px_40px]" onContextMenu={menu.onContextMenu}>
      <div className="flex min-w-0 items-center gap-3">
        {isFolderItem ? <FolderGlyph size={34} /> : item.thumb_url ? (
          <img src={item.thumb_url} alt="" loading="lazy" className="size-[34px] shrink-0 rounded-[10px] object-cover" />
        ) : <FileGlyph mime={item.mime_type} size={34} />}
        <div className="min-w-0">
          <p className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{item.name}</span>
            <Badges item={item} />
          </p>
          <p className="truncate text-xs text-fg-3 sm:hidden">
            {showLocation ? `in ${location || 'My Files'}` : isFolderItem ? folderMeta(item) : `${formatBytes(item.size)} · ${formatRelative(item.activity_at || item.created_at)}`}
          </p>
          {showLocation && <p className="hidden truncate text-xs text-fg-3 sm:block">in {location || 'My Files'}</p>}
        </div>
      </div>
      <span className="hidden text-[13px] text-fg-2 sm:block" title={formatDate(item.updated_at || item.created_at)}>{formatRelative(item.activity_at || item.updated_at || item.created_at)}</span>
      <span className="hidden text-[13px] text-fg-2 sm:block">{isFolderItem ? (Number(item.total_size) ? formatBytes(item.total_size) : '—') : formatBytes(item.size)}</span>
      <button type="button" className="absolute inset-0 rounded-[inherit]" onClick={() => actions.open(item, list)} aria-label={`${isFolderItem ? 'Open folder' : 'Preview'} ${item.name}`} />
      <MoreButton items={menu.items} name={item.name} />
      {menu.popover}
    </li>
  );
};

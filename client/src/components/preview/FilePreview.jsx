import { useCallback, useState } from 'react'
import { Link } from 'react-router-dom'
import { DownloadIcon, EllipsisVerticalIcon, FolderInputIcon, InfoIcon, Link2Icon, LockKeyholeIcon, PencilIcon, StarIcon, Trash2Icon, XIcon } from 'lucide-react'
import api from '../../config/api'
import { useActions } from '../../context/ActionsContext'
import { useDriveData } from '../../hooks/useDriveData'
import { useLocalPref } from '../../hooks/useLocalPref'
import FileViewer from './FileViewer'
import PreviewBody, { PreviewError } from './PreviewBody'
import Menu from '../ui/Menu'
import { extensionOf, fileKind } from '../../lib/files'
import { formatBytes, formatDateTime, formatRelative, pluralize } from '../../lib/format'
import { linkState } from '../../lib/share'

// "Image (JPG)", but just "PDF" where the kind already says it
const typeLabel = (file) => {
  const label = fileKind(file.mime_type).label;
  const ext = extensionOf(file.name);
  return ext && ext !== label.toUpperCase() ? `${label} (${ext})` : label;
};

const Row = ({ label, children }) => (
  <div className="flex justify-between gap-4 py-2.5 text-[13px]">
    <dt className="shrink-0 text-fg-3">{label}</dt>
    <dd className="min-w-0 text-right font-medium break-words">{children}</dd>
  </div>
);

// Details panel: what it is, where it lives, when it changed, who can see it
const Details = ({ file, link, onClose, onShare }) => {
  const state = linkState(link);
  return (
    <aside className="flex w-full flex-col overflow-y-auto border-line bg-panel-solid text-fg max-lg:fixed max-lg:inset-x-0 max-lg:bottom-16 sm:max-lg:bottom-0 max-lg:z-10 max-lg:max-h-[70dvh] max-lg:rounded-t-[28px] max-lg:border-t max-lg:shadow-deep max-lg:animate-fade-up lg:w-[340px] lg:shrink-0 lg:rounded-tl-[28px] lg:border-t lg:border-l">
      <header className="flex items-center justify-between px-5 pt-5">
        <h2 className="text-[15px] font-semibold">Details</h2>
        <button className="icon-btn icon-btn-sm" onClick={onClose} aria-label="Hide details"><XIcon size={17} /></button>
      </header>

      <dl className="mt-2 divide-y divide-line px-5">
        <Row label="Type">{typeLabel(file)}</Row>
        <Row label="Size">{formatBytes(file.size)}</Row>
        <Row label="Location">
          {file.folder_id
            ? <Link to={`/folder/${file.folder_id}`} className="text-accent-text hover:underline">{file.folder_name}</Link>
            : <Link to="/" className="text-accent-text hover:underline">My Files</Link>}
        </Row>
        <Row label="Uploaded">{formatDateTime(file.created_at)}</Row>
        {file.updated_at && new Date(file.updated_at) - new Date(file.created_at) > 1000 && <Row label="Modified">{formatDateTime(file.updated_at)}</Row>}
        {file.original_name && file.original_name !== file.name && <Row label="Original name">{file.original_name}</Row>}
      </dl>

      <div className="m-5 rounded-2xl border border-line bg-surface p-4">
        {link ? (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold"><Link2Icon size={16} className="text-accent-text" /> Public link</p>
            <p className="mt-1 text-[13px] text-fg-3">
              {link.permission === 'download' ? 'Anyone with the link can view and download' : 'Anyone with the link can view'}
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <span className="chip">Opened {pluralize(link.access_count, 'time')}</span>
              {state === 'expired' ? <span className="chip chip-danger">Expired</span>
                : state === 'never' ? <span className="chip chip-ok">No expiry</span>
                  : <span className={`chip ${state === 'soon' ? 'chip-warn' : ''}`}>Expires {formatRelative(link.expires_at)}</span>}
            </div>
            <button className="btn btn-ghost btn-sm btn-block mt-4" onClick={onShare}>Manage link</button>
          </>
        ) : (
          <>
            <p className="flex items-center gap-2 text-sm font-semibold"><LockKeyholeIcon size={16} className="text-fg-3" /> Private</p>
            <p className="mt-1 text-[13px] text-fg-3">Only you can see this file.</p>
            <button className="btn btn-ghost btn-sm btn-block mt-4" onClick={onShare}><Link2Icon size={15} /> Create a link</button>
          </>
        )}
      </div>
    </aside>
  );
};

// Owner's preview: loads a signed URL, records the open for Recent, and offers every action
const FilePreview = ({ item, list = [], onNavigate, onClose }) => {
  const actions = useActions();
  const [showInfo, setShowInfo] = useLocalPref('filenest-details', window.innerWidth >= 1024 ? 'open' : 'closed', ['open', 'closed']);
  const { data, error } = useDriveData(() => api.get(`/api/files/${item.id}/preview`).then((r) => r.data), `preview-${item.id}`);

  // Keep the first signed URL per file: refreshes (e.g. after starring) must not restart a video
  const [stable, setStable] = useState({ id: null, url: null });
  if (data && data.file.id === item.id && stable.id !== item.id) setStable({ id: item.id, url: data.url });

  const file = data?.file?.id === item.id ? data.file : item;
  const index = list.findIndex((f) => f.id === item.id);
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  const loadText = useCallback(() => api.get(`/api/files/${item.id}/text`).then((r) => r.data), [item.id]);

  const trash = async () => {
    const target = next || prev;
    await actions.trash(file);
    if (target) onNavigate(target);
    else onClose();
  };

  const toolbar = (
    <>
      <button className={`icon-btn ${file.is_starred ? 'active' : ''}`} onClick={() => actions.toggleStar(file)} aria-label={file.is_starred ? 'Remove from Starred' : 'Add to Starred'} aria-pressed={Boolean(file.is_starred)} data-tip={file.is_starred ? 'Starred' : 'Star'} data-tip-pos="bottom">
        <StarIcon size={19} className={file.is_starred ? 'fill-star text-star' : ''} />
      </button>
      <button className="icon-btn" onClick={() => actions.share(file)} aria-label="Share link" data-tip="Share" data-tip-pos="bottom"><Link2Icon size={19} /></button>
      <button className="icon-btn" onClick={() => actions.download(file)} aria-label="Download" data-tip="Download" data-tip-pos="bottom"><DownloadIcon size={19} /></button>
      <button className={`icon-btn ${showInfo === 'open' ? 'active' : ''}`} onClick={() => setShowInfo(showInfo === 'open' ? 'closed' : 'open')} aria-label="Details" aria-pressed={showInfo === 'open'} data-tip="Details" data-tip-pos="bottom">
        <InfoIcon size={19} />
      </button>
      <Menu
        label="More actions"
        items={[
          { label: 'Rename', icon: PencilIcon, onClick: () => actions.rename(file) },
          { label: 'Move to…', icon: FolderInputIcon, onClick: () => actions.move(file) },
          { separator: true },
          { label: 'Move to Trash', icon: Trash2Icon, danger: true, onClick: trash },
        ]}
      >
        {(props) => <button {...props} className="icon-btn" aria-label="More actions"><EllipsisVerticalIcon size={19} /></button>}
      </Menu>
    </>
  );

  return (
    <FileViewer
      file={file}
      actions={toolbar}
      onClose={onClose}
      onPrev={prev ? () => onNavigate(prev) : undefined}
      onNext={next ? () => onNavigate(next) : undefined}
      position={index >= 0 ? { index, total: list.length } : undefined}
      side={showInfo === 'open' && data && (
        <Details file={file} link={data.share_link} onClose={() => setShowInfo('closed')} onShare={() => actions.share(file)} />
      )}
    >
      {error ? (
        <PreviewError message={error.response?.status === 404 ? 'This file no longer exists.' : "Couldn't load the preview."} />
      ) : (
        <PreviewBody file={file} url={stable.id === item.id ? stable.url : null} loadText={loadText} onDownload={() => actions.download(file)} />
      )}
    </FileViewer>
  );
};

export default FilePreview

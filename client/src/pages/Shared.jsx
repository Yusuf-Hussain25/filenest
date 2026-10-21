import { useState } from 'react'
import toast from 'react-hot-toast'
import { CopyIcon, DownloadIcon, ExternalLinkIcon, EyeIcon, Link2Icon, Link2OffIcon, RotateCcwIcon, Settings2Icon } from 'lucide-react'
import api, { errorMessage } from '../config/api'
import { useActions } from '../context/ActionsContext'
import { useDriveData } from '../hooks/useDriveData'
import { emitDriveChange } from '../lib/events'
import { copyText, linkState, shareUrl } from '../lib/share'
import { formatBytes, formatDateTime, formatRelative, pluralize } from '../lib/format'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FileGlyph, FolderGlyph } from '../components/ui/FileGlyph'

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
];

const StateChip = ({ link }) => {
  const state = linkState(link);
  if (state === 'expired') return <span className="chip chip-danger">Expired {formatRelative(link.expires_at)}</span>;
  if (state === 'never') return <span className="chip chip-ok">No expiry</span>;
  return <span className={`chip ${state === 'soon' ? 'chip-warn' : ''}`} title={formatDateTime(link.expires_at)}>Expires {formatRelative(link.expires_at)}</span>;
};

// Every public link you've made: who can do what, until when, and how often it was opened
const Shared = () => {
  const actions = useActions();
  const { data, loading, error, reload } = useDriveData(() => api.get('/api/shares').then((r) => r.data.share_links), 'shares');
  const [filter, setFilter] = useState('all');
  const [revoking, setRevoking] = useState(null);

  const links = (data || []).filter((l) => {
    const expired = linkState(l) === 'expired';
    return filter === 'all' || (filter === 'expired' ? expired : !expired);
  });
  const totalViews = (data || []).reduce((n, l) => n + l.access_count, 0);

  const copy = async (link) => {
    await copyText(shareUrl(link.token));
    toast.success('Link copied');
  };

  const revoke = async () => {
    try {
      await api.delete(`/api/shares/${revoking.id}`);
      toast.success('Link revoked. It no longer works.');
      emitDriveChange();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not revoke the link.'));
    }
  };

  // The share dialog takes the item the link points to (folders have no mime_type)
  const manage = (link) => actions.share(link.resource);

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Shared links</h1>
          <p className="mt-1 text-sm text-fg-3">
            {data ? `${pluralize(data.length, 'link')} · opened ${pluralize(totalViews, 'time')} in total` : 'Public links to your files and folders'}
          </p>
        </div>
        <div className="segmented" role="group" aria-label="Filter links">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-[74px] rounded-[20px]" />)}</div>
      ) : error ? (
        <EmptyState icon={<RotateCcwIcon size={24} />} title="Couldn't load your links" action={<button className="btn btn-primary" onClick={reload}>Try again</button>} />
      ) : !links.length ? (
        <EmptyState icon={<Link2Icon size={26} />} title={filter === 'all' ? 'No shared links yet' : `No ${filter} links`}>
          {filter === 'all' ? 'Open the ⋯ menu on any file or folder and choose “Share link” to create one.' : 'Try another filter.'}
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {links.map((link) => {
            const isFolderLink = link.resource_type === 'folder';
            const expired = linkState(link) === 'expired';
            return (
              <li key={link.id} className={`tile flex flex-wrap items-center gap-x-4 gap-y-3 p-3.5 sm:flex-nowrap ${expired ? 'opacity-75' : ''}`}>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  {isFolderLink ? <FolderGlyph size={40} /> : <FileGlyph mime={link.resource.mime_type} size={40} />}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{link.resource.name}</p>
                    <p className="truncate text-xs text-fg-3">
                      {isFolderLink ? 'Folder' : formatBytes(link.resource.size)} · created {formatRelative(link.created_at)}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="chip">
                    {link.permission === 'download' ? <DownloadIcon size={12} /> : <EyeIcon size={12} />}
                    {link.permission === 'download' ? 'Can download' : 'View only'}
                  </span>
                  <StateChip link={link} />
                  <span className="chip tabular-nums">{pluralize(link.access_count, 'open')}</span>
                </div>

                <div className="ml-auto flex items-center gap-0.5">
                  <button className="icon-btn icon-btn-sm" onClick={() => copy(link)} aria-label={`Copy link to ${link.resource.name}`} data-tip="Copy link" disabled={expired}><CopyIcon size={16} /></button>
                  <a className={`icon-btn icon-btn-sm ${expired ? 'pointer-events-none opacity-45' : ''}`} href={shareUrl(link.token)} target="_blank" rel="noreferrer" aria-label={`Open link to ${link.resource.name}`} data-tip="Open"><ExternalLinkIcon size={16} /></a>
                  <button className="icon-btn icon-btn-sm" onClick={() => manage(link)} aria-label={`Link settings for ${link.resource.name}`} data-tip="Settings"><Settings2Icon size={16} /></button>
                  <button className="icon-btn icon-btn-sm hover:!text-danger" onClick={() => setRevoking(link)} aria-label={`Revoke link to ${link.resource.name}`} data-tip="Revoke"><Link2OffIcon size={16} /></button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog open={Boolean(revoking)} onClose={() => setRevoking(null)} onConfirm={revoke} title="Revoke this link?" confirmLabel="Revoke link">
        Anyone who has the link to <strong className="text-fg">{revoking?.resource.name}</strong> will lose access. You can create a new link later.
      </ConfirmDialog>
    </div>
  );
};

export default Shared

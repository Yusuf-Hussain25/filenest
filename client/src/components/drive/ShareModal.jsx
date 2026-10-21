import { useState } from 'react'
import toast from 'react-hot-toast'
import { CheckIcon, CopyIcon, DownloadIcon, ExternalLinkIcon, EyeIcon, GlobeIcon, Link2Icon, Link2OffIcon } from 'lucide-react'
import Modal from '../ui/Modal'
import api, { errorMessage } from '../../config/api'
import { useDriveData } from '../../hooks/useDriveData'
import { emitDriveChange } from '../../lib/events'
import { formatDateTime, formatRelative, pluralize } from '../../lib/format'
import { isFolder } from '../../lib/files'
import { copyText, shareUrl } from '../../lib/share'

const EXPIRY = [
  { value: 'never', label: 'Never expires', days: null },
  { value: '1', label: '1 day from now', days: 1 },
  { value: '7', label: '7 days from now', days: 7 },
  { value: '30', label: '30 days from now', days: 30 },
];

const expiryDate = (choice) => {
  const days = EXPIRY.find((e) => e.value === choice)?.days;
  return days ? new Date(Date.now() + days * 86400000).toISOString() : null;
};

const PermissionPicker = ({ value, onChange, disabled }) => (
  <div className="segmented w-full" role="group" aria-label="What people with the link can do">
    <button type="button" aria-pressed={value === 'view'} className="flex-1 justify-center" onClick={() => onChange('view')} disabled={disabled}>
      <EyeIcon size={14} /> Can view
    </button>
    <button type="button" aria-pressed={value === 'download'} className="flex-1 justify-center" onClick={() => onChange('download')} disabled={disabled}>
      <DownloadIcon size={14} /> Can download
    </button>
  </div>
);

// Create, copy, configure and revoke the public link of a file or folder
const ShareModal = ({ item, onClose }) => {
  const kind = isFolder(item) ? 'folder' : 'file';
  const { data: link, loading, error } = useDriveData(
    () => api.get('/api/shares').then((r) => r.data.share_links.find((l) => l.resource_id === item.id) || null),
    `share-${item.id}`
  );
  const [draft, setDraft] = useState({ permission: 'view', expiry: '7' });
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const expired = link?.expires_at && new Date(link.expires_at) < new Date();

  const run = async (fn, success) => {
    setBusy(true);
    try {
      await fn();
      if (success) toast.success(success);
      // Refreshes this dialog and every view showing the item's shared badge
      emitDriveChange();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update the link.'));
    } finally {
      setBusy(false);
    }
  };

  const create = () => run(async () => {
    const { data } = await api.post('/api/shares', {
      resource_type: kind,
      resource_id: item.id,
      permission: draft.permission,
      expires_at: expiryDate(draft.expiry),
    });
    await copyText(shareUrl(data.share_link.token));
    setCopied(true);
  }, 'Link created and copied');

  const update = (body, success) => run(() => api.patch(`/api/shares/${link.id}`, body), success);
  const revoke = () => run(() => api.delete(`/api/shares/${link.id}`), 'Link revoked. It no longer works.');

  const copy = async () => {
    await copyText(shareUrl(link.token));
    setCopied(true);
    toast.success('Link copied');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal
      open
      onClose={busy ? undefined : onClose}
      title={`Share "${item.name}"`}
      subtitle={link ? 'Anyone with the link can open it, no account needed' : 'Create a public link'}
      icon={<Link2Icon size={19} />}
      footer={link ? (
        <>
          <button className="btn btn-ghost mr-auto text-danger" onClick={revoke} disabled={busy}>
            <Link2OffIcon size={16} /> Revoke link
          </button>
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </>
      ) : (
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button>
          <button className="btn btn-primary" onClick={create} disabled={busy || loading || Boolean(error)}>
            {busy ? <span className="spinner size-4" /> : <Link2Icon size={16} />}
            Create link
          </button>
        </>
      )}
    >
      <div className="space-y-5 px-5 py-5 sm:px-6">
        {loading ? (
          <div className="space-y-3"><div className="skeleton h-12" /><div className="skeleton h-10" /><div className="skeleton h-10 w-2/3" /></div>
        ) : error ? (
          <p className="text-sm text-danger">Couldn't load this item's link. Close and try again.</p>
        ) : link ? (
          <>
            <div className="flex gap-2">
              <input className="input min-w-0 flex-1 font-mono text-[13px]" readOnly value={shareUrl(link.token)} onFocus={(e) => e.target.select()} aria-label="Share link" />
              <button className="btn btn-ghost shrink-0" onClick={copy} aria-label="Copy link">
                {copied ? <CheckIcon size={16} className="text-ok" /> : <CopyIcon size={16} />}
                <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </button>
              <a className="btn btn-ghost shrink-0 !px-3" href={shareUrl(link.token)} target="_blank" rel="noreferrer" aria-label="Open link in a new tab" data-tip="Open link">
                <ExternalLinkIcon size={16} />
              </a>
            </div>

            <div className="field">
              <label>People with the link</label>
              <PermissionPicker
                value={link.permission}
                disabled={busy}
                onChange={(permission) => permission !== link.permission && update({ permission }, permission === 'view' ? 'Link is now view only' : 'Link now allows downloads')}
              />
            </div>

            <div className="field">
              <label htmlFor="expiry">Expiry</label>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="expiry"
                  className="input min-w-0 flex-1"
                  value=""
                  disabled={busy}
                  onChange={(e) => update({ expires_at: expiryDate(e.target.value) }, 'Expiry updated')}
                >
                  <option value="" disabled>Change expiry…</option>
                  {EXPIRY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {expired ? (
                  <span className="chip chip-danger">Expired {formatRelative(link.expires_at)}</span>
                ) : link.expires_at ? (
                  <span className="chip chip-warn" title={formatDateTime(link.expires_at)}>Expires {formatRelative(link.expires_at)}</span>
                ) : (
                  <span className="chip chip-ok">Never expires</span>
                )}
              </div>
            </div>

            <p className="flex items-center gap-2 rounded-xl bg-surface px-3.5 py-3 text-[13px] text-fg-2">
              <GlobeIcon size={15} className="shrink-0 text-fg-3" />
              Opened {pluralize(link.access_count, 'time')} · created {formatRelative(link.created_at)}
            </p>
          </>
        ) : (
          <>
            <p className="rounded-xl bg-surface px-3.5 py-3 text-[13px] leading-relaxed text-fg-2">
              Anyone with the link can open this {kind} without signing in. You can change these settings or revoke the link later.
            </p>
            <div className="field">
              <label>People with the link</label>
              <PermissionPicker value={draft.permission} onChange={(permission) => setDraft((d) => ({ ...d, permission }))} disabled={busy} />
            </div>
            <div className="field">
              <label htmlFor="new-expiry">Expiry</label>
              <select id="new-expiry" className="input" value={draft.expiry} onChange={(e) => setDraft((d) => ({ ...d, expiry: e.target.value }))} disabled={busy}>
                {EXPIRY.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

export default ShareModal

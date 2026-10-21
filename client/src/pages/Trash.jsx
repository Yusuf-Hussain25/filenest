import { useState } from 'react'
import toast from 'react-hot-toast'
import { RotateCcwIcon, Trash2Icon, XIcon } from 'lucide-react'
import api, { errorMessage } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useActions } from '../context/ActionsContext'
import { useDriveData } from '../hooks/useDriveData'
import { emitDriveChange } from '../lib/events'
import { formatBytes, formatDateTime, formatRelative, pluralize } from '../lib/format'
import EmptyState from '../components/ui/EmptyState'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { FileGlyph, FolderGlyph } from '../components/ui/FileGlyph'

// What you deleted, newest first: restore it where it was, or delete it for good
const Trash = () => {
  const { refreshUser } = useAuth();
  const actions = useActions();
  const { data, loading, error, reload } = useDriveData(() => api.get('/api/trash').then((r) => r.data), 'trash');
  const [confirm, setConfirm] = useState(null); // { item } | { all: true }
  const [busyId, setBusyId] = useState(null);

  const items = data
    ? [...data.folders.map((f) => ({ ...f, isFolder: true })), ...data.files].sort((a, b) => new Date(b.trashed_at) - new Date(a.trashed_at))
    : [];
  const totalSize = items.reduce((n, i) => n + Number(i.isFolder ? i.total_size : i.size), 0);

  const restore = async (item) => {
    setBusyId(item.id);
    await actions.restore(item.isFolder ? { id: item.id, name: item.name } : item);
    setBusyId(null);
  };

  const deleteForever = async () => {
    try {
      if (confirm.all) {
        await api.post('/api/trash/empty');
        toast.success('Trash emptied');
      } else {
        const { item } = confirm;
        await api.delete(`/api/${item.isFolder ? 'folders' : 'files'}/${item.id}/permanent`);
        toast.success(`Deleted "${item.name}" forever`);
      }
      emitDriveChange();
      refreshUser();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete it.'));
    }
  };

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Trash</h1>
          <p className="mt-1 text-sm text-fg-3">
            {items.length ? `${pluralize(items.length, 'item')} · ${formatBytes(totalSize)} · kept until you restore them or empty the Trash` : 'Deleted files and folders wait here'}
          </p>
        </div>
        <button className="btn btn-ghost btn-sm text-danger" onClick={() => setConfirm({ all: true })} disabled={!items.length}>
          <Trash2Icon size={15} /> Empty Trash
        </button>
      </div>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-[70px] rounded-[20px]" />)}</div>
      ) : error ? (
        <EmptyState icon={<RotateCcwIcon size={24} />} title="Couldn't load the Trash" action={<button className="btn btn-primary" onClick={reload}>Try again</button>} />
      ) : !items.length ? (
        <EmptyState icon={<Trash2Icon size={26} />} title="Trash is empty">Things you delete land here first, so you can change your mind.</EmptyState>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="tile flex items-center gap-3 p-3">
              {item.isFolder ? <FolderGlyph size={40} /> : <FileGlyph mime={item.mime_type} size={40} />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{item.name}</p>
                <p className="truncate text-xs text-fg-3" title={formatDateTime(item.trashed_at)}>
                  Deleted {formatRelative(item.trashed_at)} · {item.isFolder
                    ? `${item.file_count ? pluralize(item.file_count, 'file') : 'no files'}${Number(item.total_size) ? `, ${formatBytes(item.total_size)}` : ''}`
                    : formatBytes(item.size)}
                </p>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => restore(item)} disabled={busyId === item.id}>
                {busyId === item.id ? <span className="spinner size-4" /> : <RotateCcwIcon size={15} />}
                <span className="hidden sm:inline">Restore</span>
              </button>
              <button className="icon-btn icon-btn-sm hover:!text-danger" onClick={() => setConfirm({ item })} aria-label={`Delete ${item.name} forever`} data-tip="Delete forever">
                <XIcon size={17} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        onConfirm={deleteForever}
        title={confirm?.all ? 'Empty the Trash?' : 'Delete forever?'}
        confirmLabel={confirm?.all ? 'Empty Trash' : 'Delete forever'}
      >
        {confirm?.all
          ? <>All {pluralize(items.length, 'item')} ({formatBytes(totalSize)}) will be deleted for good and their space freed. This can't be undone.</>
          : <><strong className="text-fg">{confirm?.item.name}</strong>{confirm?.item.isFolder ? ' and everything inside it' : ''} will be deleted for good. This can't be undone.</>}
      </ConfirmDialog>
    </div>
  );
};

export default Trash

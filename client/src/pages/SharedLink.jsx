import { useCallback, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { ChevronRightIcon, ClockIcon, DownloadIcon, EyeIcon, Link2OffIcon, ShieldCheckIcon, TimerOffIcon } from 'lucide-react'
import api from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useDriveData } from '../hooks/useDriveData'
import Logo from '../components/ui/Logo'
import Avatar from '../components/ui/Avatar'
import ThemeToggle from '../components/ui/ThemeToggle'
import EmptyState from '../components/ui/EmptyState'
import { FileGlyph, FolderGlyph } from '../components/ui/FileGlyph'
import FileViewer from '../components/preview/FileViewer'
import PreviewBody from '../components/preview/PreviewBody'
import { fileKind } from '../lib/files'
import { formatBytes, formatDateTime, formatRelative, pluralize } from '../lib/format'

// Saves through the signed URL, which answers with Content-Disposition: attachment
const DownloadLink = ({ file, className = 'btn btn-primary' }) => (
  <a href={file.download_url} className={className} rel="noopener">
    <DownloadIcon size={17} /> Download
  </a>
);

const Header = () => {
  const { user } = useAuth();
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
      <Link to={user ? '/' : '/login'} aria-label="Filenest"><Logo size={30} /></Link>
      <div className="flex items-center gap-2">
        <ThemeToggle tipPos="bottom" />
        <Link to={user ? '/' : '/register'} className="btn btn-ghost btn-sm">{user ? 'Go to my files' : 'Get Filenest free'}</Link>
      </div>
    </header>
  );
};

// Everyone with the link lands here: no account needed
const SharedLink = () => {
  const { token } = useParams();
  const [params, setParams] = useSearchParams();
  const folderId = params.get('folder');
  const { data, loading, error } = useDriveData(
    () => api.get(`/api/shares/access/${token}`, { params: folderId ? { folder: folderId } : {} }).then((r) => r.data),
    `${token}|${folderId || ''}`
  );
  const [viewing, setViewing] = useState(null);

  const loadText = useCallback(
    () => api.get(`/api/shares/access/${token}/text`, { params: { file: viewing?.id ?? data?.file?.id } }).then((r) => r.data),
    [token, viewing?.id, data?.file?.id]
  );

  if (loading) {
    return (
      <div className="min-h-dvh">
        <Header />
        <main className="mx-auto max-w-6xl px-4 sm:px-8">
          <div className="card p-6"><div className="skeleton h-5 w-56" /><div className="skeleton mt-6 h-[50vh] rounded-2xl" /></div>
        </main>
      </div>
    );
  }

  if (error) {
    const expired = error.response?.status === 410;
    return (
      <div className="min-h-dvh">
        <Header />
        <main className="mx-auto max-w-xl px-4">
          <div className="card mt-6">
            <EmptyState
              icon={expired ? <TimerOffIcon size={26} /> : <Link2OffIcon size={26} />}
              title={expired ? 'This link has expired' : "This link doesn't work"}
              action={<Link to="/" className="btn btn-primary">Open Filenest</Link>}
            >
              {expired
                ? 'The owner set it to stop working after a while. Ask them for a new link.'
                : error.response?.data?.error || 'It may have been revoked, or the item was deleted.'}
            </EmptyState>
          </div>
        </main>
      </div>
    );
  }

  const isFolderShare = data.resource_type === 'folder';
  const files = isFolderShare ? data.files : [data.file];
  const canDownload = data.permission === 'download';
  const index = viewing ? files.findIndex((f) => f.id === viewing.id) : -1;

  return (
    <div className="min-h-dvh pb-16">
      <Header />
      <main className="mx-auto max-w-6xl px-4 animate-fade-up sm:px-8">
        <section className="card p-5 sm:p-7">
          {/* Who shared it, and on what terms */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Avatar name={data.owner.name} size={40} />
              <div className="min-w-0">
                <p className="truncate text-sm"><span className="font-semibold">{data.owner.name}</span> shared {isFolderShare ? 'a folder' : 'a file'} with you</p>
                <p className="text-xs text-fg-3">Anyone with this link can {canDownload ? 'view and download' : 'view'} it</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="chip">{canDownload ? <DownloadIcon size={12} /> : <EyeIcon size={12} />}{canDownload ? 'Can download' : 'View only'}</span>
              {data.expires_at && <span className="chip chip-warn" title={formatDateTime(data.expires_at)}><ClockIcon size={12} /> Expires {formatRelative(data.expires_at)}</span>}
            </div>
          </div>

          <div className="my-5 h-px bg-line" />

          {isFolderShare ? (
            <>
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div className="min-w-0">
                  {data.breadcrumbs.length > 1 && <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1 text-sm text-fg-3">
                    {data.breadcrumbs.map((c, i) => (
                      <span key={c.id} className="flex items-center gap-1">
                        {i > 0 && <ChevronRightIcon size={14} />}
                        {i < data.breadcrumbs.length - 1
                          ? <button className="rounded px-1 hover:text-fg" onClick={() => setParams(i === 0 ? {} : { folder: c.id })}>{c.name}</button>
                          : <span className="font-medium text-fg" aria-current="page">{c.name}</span>}
                      </span>
                    ))}
                  </nav>}
                  <h1 className="mt-1.5 flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
                    <FolderGlyph size={30} open /> {data.folder.name}
                  </h1>
                </div>
                <p className="text-sm text-fg-3">
                  {[data.subfolders.length && pluralize(data.subfolders.length, 'folder'), files.length && pluralize(files.length, 'file')].filter(Boolean).join(' · ') || 'Empty folder'}
                </p>
              </div>

              {data.subfolders.length > 0 && (
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {data.subfolders.map((f) => (
                    <button key={f.id} className="tile flex items-center gap-3 p-3 text-left" onClick={() => setParams({ folder: f.id })}>
                      <FolderGlyph size={36} />
                      <span className="truncate text-sm font-semibold">{f.name}</span>
                    </button>
                  ))}
                </div>
              )}

              {files.length > 0 ? (
                <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {files.map((f) => (
                    <article key={f.id} className="tile group relative overflow-hidden">
                      <div className="grid aspect-[4/3] place-items-center overflow-hidden border-b border-line" style={f.mime_type.startsWith('image/') ? undefined : { background: `linear-gradient(145deg, ${fileKind(f.mime_type).from}22, ${fileKind(f.mime_type).to}14)` }}>
                        {f.mime_type.startsWith('image/')
                          ? <img src={f.url} alt="" loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                          : <FileGlyph mime={f.mime_type} name={f.name} size={48} showExt />}
                      </div>
                      <div className="flex items-center gap-2 py-2.5 pr-2 pl-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13.5px] font-semibold">{f.name}</p>
                          <p className="text-xs text-fg-3">{formatBytes(f.size)}</p>
                        </div>
                        {canDownload && (
                          <a href={f.download_url} className="icon-btn icon-btn-sm relative z-10" aria-label={`Download ${f.name}`} data-tip="Download"><DownloadIcon size={16} /></a>
                        )}
                      </div>
                      <button className="absolute inset-0" onClick={() => setViewing(f)} aria-label={`Preview ${f.name}`} />
                    </article>
                  ))}
                </div>
              ) : !data.subfolders.length && (
                <p className="py-12 text-center text-sm text-fg-3">This folder is empty.</p>
              )}
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <FileGlyph mime={data.file.mime_type} size={42} />
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-semibold tracking-tight">{data.file.name}</h1>
                    <p className="text-[13px] text-fg-3">{fileKind(data.file.mime_type).label} · {formatBytes(data.file.size)}</p>
                  </div>
                </div>
                {canDownload && <DownloadLink file={data.file} />}
              </div>
              <div data-theme="dark" className="mt-5 flex h-[min(68vh,640px)] items-center justify-center overflow-hidden rounded-[22px] bg-[#05080d] p-3 sm:p-6">
                <PreviewBody file={data.file} url={data.file.url} loadText={loadText} />
              </div>
            </>
          )}
        </section>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-fg-3">
          <ShieldCheckIcon size={13} /> Shared securely with Filenest
        </p>
      </main>

      {viewing && (
        <FileViewer
          file={viewing}
          onClose={() => setViewing(null)}
          onPrev={index > 0 ? () => setViewing(files[index - 1]) : undefined}
          onNext={index < files.length - 1 ? () => setViewing(files[index + 1]) : undefined}
          position={{ index, total: files.length }}
          actions={canDownload && (
            <a href={viewing.download_url} className="icon-btn" aria-label={`Download ${viewing.name}`} data-tip="Download" data-tip-pos="bottom"><DownloadIcon size={19} /></a>
          )}
        >
          <PreviewBody key={viewing.id} file={viewing} url={viewing.url} loadText={loadText} />
        </FileViewer>
      )}
    </div>
  );
};

export default SharedLink

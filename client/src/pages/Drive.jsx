import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRightIcon, EllipsisIcon, FolderOpenIcon, FolderPlusIcon, FolderXIcon, Link2Icon, RotateCcwIcon, StarIcon, UploadIcon } from 'lucide-react'
import api from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useActions } from '../context/ActionsContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useDriveData } from '../hooks/useDriveData'
import { useLocalPref } from '../hooks/useLocalPref'
import Breadcrumbs from '../components/drive/Breadcrumbs'
import ViewControls from '../components/drive/ViewControls'
import ItemCollection, { CollectionSkeleton } from '../components/drive/ItemCollection'
import { FileCard } from '../components/drive/ItemViews'
import EmptyState from '../components/ui/EmptyState'
import Menu from '../components/ui/Menu'
import { SORT_OPTIONS } from '../lib/files'
import { formatBytes, greeting, pluralize } from '../lib/format'

const SORTS = SORT_OPTIONS.map((o) => o.value);
const ROOT_CRUMBS = [{ id: null, name: 'My Files' }];

// My Files (root) and every folder page
const Drive = () => {
  const { folderId } = useParams();
  const { user } = useAuth();
  const actions = useActions();
  const { setHere, pickFiles, stats } = useWorkspace();
  const [view, setView] = useLocalPref('filenest-view', 'grid', ['grid', 'list']);
  const [sort, setSort] = useLocalPref('filenest-sort', 'name_asc', SORTS);

  const listing = useDriveData(async () => {
    const parent = folderId || 'root';
    const [folders, files, details] = await Promise.all([
      api.get('/api/folders', { params: { parent_id: parent } }),
      api.get('/api/files', { params: { folder_id: parent, sort, limit: 100 } }),
      folderId ? api.get(`/api/folders/${folderId}`) : null,
    ]);
    return {
      folders: folders.data.folders,
      files: files.data.files,
      total: files.data.pagination.totalFiles,
      folder: details?.data.folder ?? null,
      crumbs: details?.data.breadcrumbs ?? ROOT_CRUMBS,
    };
  }, `${folderId || 'root'}|${sort}`);

  const recent = useDriveData(
    () => (folderId ? Promise.resolve([]) : api.get('/api/drive/recent', { params: { limit: 6 } }).then((r) => r.data.files)),
    `recent-strip|${folderId || 'root'}`
  );

  const { data, loading, error } = listing;
  const folder = data?.folder;

  // Uploads and "New folder" go to the folder on screen
  useEffect(() => {
    setHere(folderId && folder ? { id: folder.id, name: folder.name } : null);
  }, [folderId, folder, setHere]);

  const notFound = error?.response?.status === 404;
  const empty = data && !data.folders.length && !data.files.length;
  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div className="animate-fade-up">
      {/* Header */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <div className="min-w-0 flex-1">
          {folderId ? (
            <>
              {data ? <Breadcrumbs crumbs={data.crumbs} /> : <div className="skeleton h-4 w-48" />}
              <div className="mt-2 flex min-w-0 items-center gap-2">
                <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-[28px]">{folder?.name || (notFound ? 'Folder not found' : ' ')}</h1>
                {folder?.is_starred && <StarIcon size={18} className="shrink-0 fill-star text-star" aria-label="Starred" />}
                {folder && (
                  <Menu items={actions.menuFor(folder).filter((i) => i.label !== 'Open')} label={`Actions for ${folder.name}`}>
                    {(props) => (
                      <button {...props} className="icon-btn icon-btn-sm shrink-0" aria-label={`More actions for ${folder.name}`}>
                        <EllipsisIcon size={18} />
                      </button>
                    )}
                  </Menu>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="eyebrow">{greeting()}, {firstName}</p>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-[28px]">My Files</h1>
              {stats && (
                <p className="mt-1 text-sm text-fg-3">
                  {pluralize(stats.counts.files, 'file')} in {pluralize(stats.counts.folders, 'folder')} · {formatBytes(stats.storage_used)} used
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {folder && (
            <button className="btn btn-ghost btn-sm" onClick={() => actions.share(folder)}>
              <Link2Icon size={15} /> <span className="hidden sm:inline">{folder.is_shared ? 'Manage link' : 'Share'}</span>
            </button>
          )}
          <button className="btn btn-ghost btn-sm hidden sm:inline-flex" onClick={() => actions.newFolder(folder?.id ?? null, folder?.name ?? 'My Files')} disabled={notFound}>
            <FolderPlusIcon size={15} /> New folder
          </button>
          <ViewControls view={view} onView={setView} sort={sort} onSort={setSort} />
        </div>
      </div>

      {/* Recent strip on My Files */}
      {!folderId && recent.data?.length > 0 && (
        <section className="mb-9">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-fg-2">Recent</h2>
            <Link to="/recent" className="flex items-center gap-1 text-[13px] font-medium text-accent-text hover:underline">
              See all <ArrowRightIcon size={14} />
            </Link>
          </div>
          <div className="-mx-3 flex snap-x gap-3 overflow-x-auto px-3 pb-2 sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {recent.data.map((f, i) => (
              <div key={f.id} className={`w-[168px] flex-none snap-start sm:w-auto ${i >= 3 ? 'sm:hidden lg:block' : ''} ${i >= 4 ? 'lg:hidden xl:block' : ''} ${i >= 5 ? 'xl:hidden 2xl:block' : ''}`}>
                <FileCard file={f} list={recent.data} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Contents */}
      {loading ? (
        <CollectionSkeleton view={view} />
      ) : notFound ? (
        <EmptyState
          icon={<FolderXIcon size={26} />}
          title="This folder doesn't exist"
          action={<Link to="/" className="btn btn-primary">Back to My Files</Link>}
        >
          It may have been moved to the Trash or deleted.
        </EmptyState>
      ) : error ? (
        <EmptyState icon={<RotateCcwIcon size={24} />} title="Couldn't load this folder" action={<button className="btn btn-primary" onClick={listing.reload}>Try again</button>}>
          Check your connection and try again.
        </EmptyState>
      ) : empty ? (
        <div className="rounded-[28px] border-2 border-dashed border-line-strong">
          <EmptyState
            icon={<FolderOpenIcon size={26} />}
            title={folderId ? 'This folder is empty' : 'Your drive is empty'}
            action={
              <>
                <button className="btn btn-primary" onClick={pickFiles}><UploadIcon size={17} /> Upload files</button>
                <button className="btn btn-ghost" onClick={() => actions.newFolder(folder?.id ?? null, folder?.name ?? 'My Files')}><FolderPlusIcon size={17} /> New folder</button>
              </>
            }
          >
            Drag files anywhere onto this page, or use the buttons below.
          </EmptyState>
        </div>
      ) : (
        <>
          <ItemCollection folders={data.folders} files={data.files} view={view} />
          {data.total > data.files.length && (
            <p className="mt-6 text-center text-sm text-fg-3">
              Showing the first {data.files.length} of {data.total} files. Use search (⌘K) to find the rest.
            </p>
          )}
        </>
      )}
    </div>
  );
};

export default Drive

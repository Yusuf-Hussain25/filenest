import { FileCard, FolderCard, ItemRow } from './ItemViews'

const SectionTitle = ({ children, count }) => (
  <h2 className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-fg-2">
    {children}
    {count !== undefined && <span className="chip !h-5 !px-2 !text-[11px]">{count}</span>}
  </h2>
);

// Loading placeholders shaped like the real grid or list
export const CollectionSkeleton = ({ view = 'grid', folders = 4, files = 8 }) => view === 'list' ? (
  <div className="space-y-1.5" aria-hidden="true">
    {Array.from({ length: folders + files }, (_, i) => (
      <div key={i} className="flex items-center gap-3 px-3 py-2">
        <div className="skeleton size-[34px] rounded-[10px]" />
        <div className="flex-1 space-y-1.5"><div className="skeleton h-3.5 w-1/3" /><div className="skeleton h-3 w-1/5 sm:hidden" /></div>
        <div className="skeleton hidden h-3.5 w-20 sm:block" />
        <div className="skeleton hidden h-3.5 w-14 sm:block" />
      </div>
    ))}
  </div>
) : (
  <div className="space-y-8" aria-hidden="true">
    {folders > 0 && (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: folders }, (_, i) => (
          <div key={i} className="tile flex items-center gap-3 p-3"><div className="skeleton size-10 rounded-xl" /><div className="flex-1 space-y-1.5"><div className="skeleton h-3.5 w-2/3" /><div className="skeleton h-3 w-1/3" /></div></div>
        ))}
      </div>
    )}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
      {Array.from({ length: files }, (_, i) => (
        <div key={i} className="tile overflow-hidden"><div className="skeleton aspect-[4/3] rounded-none" /><div className="space-y-1.5 p-3"><div className="skeleton h-3.5 w-3/4" /><div className="skeleton h-3 w-1/2" /></div></div>
      ))}
    </div>
  </div>
);

// Folders, then files, as a grid of cards or a list with columns
const ItemCollection = ({ folders = [], files = [], view = 'grid', showLocation = false, titles = true }) => {
  const all = [...folders, ...files];

  if (view === 'list') {
    return (
      <div>
        <div className="hidden grid-cols-[minmax(0,1fr)_140px_110px_40px] gap-3 border-b border-line px-3 pb-2 text-xs font-medium text-fg-3 sm:grid">
          <span>Name</span><span>Last activity</span><span>Size</span><span />
        </div>
        <ul className="mt-1 space-y-0.5">
          {folders.map((f) => <ItemRow key={f.id} item={f} list={all} isFolderItem showLocation={showLocation} />)}
          {files.map((f) => <ItemRow key={f.id} item={f} list={all} showLocation={showLocation} />)}
        </ul>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {folders.length > 0 && (
        <section>
          {titles && <SectionTitle count={folders.length}>Folders</SectionTitle>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
            {folders.map((f) => <FolderCard key={f.id} folder={f} list={all} showLocation={showLocation} />)}
          </div>
        </section>
      )}
      {files.length > 0 && (
        <section>
          {titles && <SectionTitle count={files.length}>Files</SectionTitle>}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
            {files.map((f) => <FileCard key={f.id} file={f} list={all} />)}
          </div>
        </section>
      )}
    </div>
  );
};

export default ItemCollection

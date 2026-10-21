import { RotateCcwIcon, StarIcon } from 'lucide-react'
import api from '../config/api'
import { useDriveData } from '../hooks/useDriveData'
import { useLocalPref } from '../hooks/useLocalPref'
import ItemCollection, { CollectionSkeleton } from '../components/drive/ItemCollection'
import ViewControls from '../components/drive/ViewControls'
import EmptyState from '../components/ui/EmptyState'

// Starred files and folders from anywhere in the drive
const Starred = () => {
  const [view, setView] = useLocalPref('filenest-view', 'grid', ['grid', 'list']);
  const { data, loading, error, reload } = useDriveData(() => api.get('/api/drive/starred').then((r) => r.data), 'starred');
  const empty = data && !data.files.length && !data.folders.length;

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Starred</h1>
          <p className="mt-1 text-sm text-fg-3">The files and folders you reach for most</p>
        </div>
        <ViewControls view={view} onView={setView} />
      </div>

      {loading ? (
        <CollectionSkeleton view={view} folders={2} files={4} />
      ) : error ? (
        <EmptyState icon={<RotateCcwIcon size={24} />} title="Couldn't load Starred" action={<button className="btn btn-primary" onClick={reload}>Try again</button>} />
      ) : empty ? (
        <EmptyState icon={<StarIcon size={26} />} title="No starred items yet">
          Open the ⋯ menu on any file or folder and choose “Add to Starred” to keep it here.
        </EmptyState>
      ) : (
        <ItemCollection folders={data.folders} files={data.files} view={view} showLocation />
      )}
    </div>
  );
};

export default Starred

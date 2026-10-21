import { ClockIcon, RotateCcwIcon } from 'lucide-react'
import api from '../config/api'
import { useDriveData } from '../hooks/useDriveData'
import { useLocalPref } from '../hooks/useLocalPref'
import ItemCollection, { CollectionSkeleton } from '../components/drive/ItemCollection'
import ViewControls from '../components/drive/ViewControls'
import EmptyState from '../components/ui/EmptyState'
import { dayGroup } from '../lib/format'

// Files you uploaded, changed or opened lately, grouped by day
const Recent = () => {
  const [view, setView] = useLocalPref('filenest-view', 'grid', ['grid', 'list']);
  const { data, loading, error, reload } = useDriveData(() => api.get('/api/drive/recent', { params: { limit: 40 } }).then((r) => r.data.files), 'recent');

  const groups = [];
  (data || []).forEach((f) => {
    const label = dayGroup(f.activity_at);
    const last = groups[groups.length - 1];
    if (last?.label === label) last.files.push(f);
    else groups.push({ label, files: [f] });
  });

  return (
    <div className="animate-fade-up">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Recent</h1>
          <p className="mt-1 text-sm text-fg-3">Files you uploaded, changed or opened lately</p>
        </div>
        <ViewControls view={view} onView={setView} />
      </div>

      {loading ? (
        <CollectionSkeleton view={view} folders={0} />
      ) : error ? (
        <EmptyState icon={<RotateCcwIcon size={24} />} title="Couldn't load recent files" action={<button className="btn btn-primary" onClick={reload}>Try again</button>} />
      ) : !groups.length ? (
        <EmptyState icon={<ClockIcon size={26} />} title="Nothing here yet">Files you upload or open will show up here.</EmptyState>
      ) : (
        <div className="space-y-9">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-3 text-[13px] font-semibold text-fg-2">{g.label}</h2>
              <ItemCollection files={g.files} view={view} showLocation titles={false} />
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default Recent

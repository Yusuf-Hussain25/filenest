import { CheckIcon, ChevronRightIcon, ClockIcon, HardDriveIcon, Link2Icon, SearchIcon, StarIcon, Trash2Icon, UploadCloudIcon } from 'lucide-react'
import { FileGlyph, FolderGlyph } from '../ui/FileGlyph'

const NAV = [
  { icon: HardDriveIcon, label: 'My Files', active: true },
  { icon: ClockIcon, label: 'Recent' },
  { icon: StarIcon, label: 'Starred' },
  { icon: Link2Icon, label: 'Shared' },
  { icon: Trash2Icon, label: 'Trash' },
];

// Photo stand-ins drawn with gradients, so the preview needs no network
const FILES = [
  { name: 'beach-sunrise.jpg', meta: '3.2 MB', thumb: 'linear-gradient(180deg,#fde68a 0%,#fb923c 38%,#0ea5e9 62%,#0369a1 100%)' },
  { name: 'itinerary.pdf', meta: '240 KB', mime: 'application/pdf' },
  { name: 'old-goa-church.jpg', meta: '2.8 MB', thumb: 'linear-gradient(160deg,#e0f2fe 0%,#f5f5f4 40%,#d6d3d1 70%,#78716c 100%)' },
  { name: 'budget.xlsx', meta: '18 KB', mime: 'application/vnd.ms-excel' },
];

// Animated mini Filenest window for the sign-in page
const DrivePreview = () => (
  <div className="relative" aria-hidden="true">
    <div className="card overflow-hidden rounded-[24px] shadow-deep">
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span className="flex gap-1.5">
          <span className="size-2.5 rounded-full bg-[#fb7185]" />
          <span className="size-2.5 rounded-full bg-[#fbbf24]" />
          <span className="size-2.5 rounded-full bg-[#34d399]" />
        </span>
        <span className="mx-auto flex h-8 w-full max-w-[260px] items-center gap-2 rounded-xl border border-line bg-surface px-3 text-xs text-fg-3">
          <SearchIcon size={13} /> Search your files
          <span className="kbd ml-auto !h-5 !min-w-0 !text-[10px]">⌘K</span>
        </span>
      </div>

      <div className="grid sm:grid-cols-[150px_1fr]">
        {/* Sidebar */}
        <div className="hidden flex-col gap-1 border-r border-line p-3 sm:flex">
          {NAV.map(({ icon: Icon, label, active }) => (
            <span key={label} className={`flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs font-medium ${active ? 'bg-accent-soft text-accent-text' : 'text-fg-2'}`}>
              <Icon size={14} /> {label}
            </span>
          ))}
          <div className="mt-auto rounded-xl border border-line bg-surface p-2.5">
            <p className="text-[10.5px] font-medium text-fg-2">412 MB of 1 GB</p>
            <div className="progress mt-1.5 !h-1.5"><span style={{ width: '41%' }} /></div>
          </div>
        </div>

        {/* Main */}
        <div className="min-w-0 p-4 sm:pb-12">
          <p className="flex items-center gap-1 text-xs text-fg-3">
            My Files <ChevronRightIcon size={12} /> Trips <ChevronRightIcon size={12} /> <span className="font-semibold text-fg">Goa 2026</span>
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {[['Photos', '48 files'], ['Tickets', '6 files']].map(([name, meta]) => (
              <span key={name} className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-2.5 py-2">
                <FolderGlyph size={26} />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-semibold">{name}</span>
                  <span className="block text-[10.5px] text-fg-3">{meta}</span>
                </span>
              </span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FILES.map((f) => (
              <span key={f.name} className="overflow-hidden rounded-xl border border-line bg-surface">
                <span className="grid h-16 place-items-center" style={f.thumb ? { background: f.thumb } : undefined}>
                  {!f.thumb && <FileGlyph mime={f.mime} size={30} />}
                </span>
                <span className="block px-2 py-1.5">
                  <span className="block truncate text-[11px] font-semibold">{f.name}</span>
                  <span className="block text-[10px] text-fg-3">{f.meta}</span>
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>

    {/* Upload progress: below the window on phones, floating over its corner on wider screens */}
    <div className="glass relative mx-auto mt-3 w-full max-w-[260px] rounded-2xl p-3 shadow-deep sm:absolute sm:-right-5 sm:-bottom-9 sm:mt-0 sm:w-[230px]">
      <p className="flex items-center gap-2 text-xs font-semibold">
        <span className="grid size-6 place-items-center rounded-lg bg-accent-soft text-accent-text"><UploadCloudIcon size={13} /></span>
        Uploading 3 files
      </p>
      <p className="mt-2 flex justify-between text-[11px] text-fg-3"><span>fort-aguada.jpg</span><span>2 of 3</span></p>
      <div className="progress mt-1.5"><span className="animate-[fill-bar_3.2s_var(--ease-out)_infinite]" style={{ width: '100%' }} /></div>
    </div>

    {/* Floating share confirmation */}
    <div className="glass absolute -top-4 right-3 flex items-center gap-2 rounded-full py-1.5 pr-3.5 pl-1.5 text-xs font-medium shadow-soft animate-[float_5s_ease-in-out_infinite] sm:-right-4">
      <span className="grid size-6 place-items-center rounded-full bg-ok/15 text-ok"><CheckIcon size={13} /></span>
      Link copied · view only, expires in 7 days
    </div>
  </div>
);

export default DrivePreview

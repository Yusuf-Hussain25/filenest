import { ArrowUpDownIcon, CheckIcon, LayoutGridIcon, ListIcon } from 'lucide-react'
import Menu from '../ui/Menu'
import { SORT_OPTIONS } from '../../lib/files'

// Grid/list switch and (optionally) the sort menu
const ViewControls = ({ view, onView, sort, onSort }) => (
  <div className="flex items-center gap-2">
    {onSort && (
      <Menu
        label="Sort files"
        items={SORT_OPTIONS.map((o) => ({ label: o.label, icon: o.value === sort ? CheckIcon : undefined, onClick: () => onSort(o.value) }))}
      >
        {(props) => (
          <button {...props} type="button" className="btn btn-ghost btn-sm" aria-label="Sort files">
            <ArrowUpDownIcon size={15} />
            <span className="hidden md:inline">{SORT_OPTIONS.find((o) => o.value === sort)?.label}</span>
          </button>
        )}
      </Menu>
    )}
    <div className="segmented !p-[3px]" role="group" aria-label="Layout">
      <button type="button" aria-pressed={view === 'grid'} onClick={() => onView('grid')} aria-label="Grid view" className="!h-[30px] !px-2.5">
        <LayoutGridIcon size={15} />
      </button>
      <button type="button" aria-pressed={view === 'list'} onClick={() => onView('list')} aria-label="List view" className="!h-[30px] !px-2.5">
        <ListIcon size={15} />
      </button>
    </div>
  </div>
);

export default ViewControls

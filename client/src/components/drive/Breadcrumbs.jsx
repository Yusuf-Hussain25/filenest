import { Fragment } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRightIcon } from 'lucide-react'

// My Files › Photos › Goa 2026 (middle crumbs collapse to "…" on phones)
const Breadcrumbs = ({ crumbs }) => (
  <nav aria-label="Breadcrumb" className="min-w-0">
    <ol className="flex min-w-0 items-center gap-1 text-sm">
      {crumbs.map((c, i) => {
        const last = i === crumbs.length - 1;
        const hiddenOnPhone = crumbs.length > 3 && i > 0 && i < crumbs.length - 2;
        return (
          <Fragment key={c.id ?? 'root'}>
            {i === 1 && crumbs.length > 3 && <li className="text-fg-3 sm:hidden" aria-hidden="true">…<ChevronRightIcon size={14} className="ml-1 inline" /></li>}
            <li className={`flex min-w-0 items-center gap-1 ${hiddenOnPhone ? 'hidden sm:flex' : ''}`}>
              {last ? (
                <span className="truncate font-medium text-fg" aria-current="page">{c.name}</span>
              ) : (
                <>
                  <Link to={c.id ? `/folder/${c.id}` : '/'} className="truncate rounded-md px-1 text-fg-3 transition-colors hover:text-fg">{c.name}</Link>
                  <ChevronRightIcon size={14} className="shrink-0 text-fg-3" aria-hidden="true" />
                </>
              )}
            </li>
          </Fragment>
        );
      })}
    </ol>
  </nav>
);

export default Breadcrumbs

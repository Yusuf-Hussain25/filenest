import { Link, useLocation } from 'react-router-dom'
import Logo from '../ui/Logo'
import NewMenu from './NewMenu'
import StorageMeter from './StorageMeter'
import { NAV, isNavActive } from './nav'
import { useAuth } from '../../context/AuthContext'
import { useWorkspace } from '../../context/WorkspaceContext'

// Desktop sidebar: New, sections with live counts, storage meter
const Sidebar = () => {
  const { user } = useAuth();
  const { stats } = useWorkspace();
  const { pathname } = useLocation();

  return (
    <aside className="glass sticky top-3 hidden h-[calc(100dvh-1.5rem)] w-[248px] shrink-0 flex-col rounded-[24px] p-3.5 shadow-soft lg:flex">
      <Link to="/" className="mb-5 rounded-lg px-1.5 pt-1" aria-label="Filenest home">
        <Logo size={30} />
      </Link>

      <NewMenu />

      <nav className="mt-5 flex flex-col gap-0.5" aria-label="Main">
        {NAV.map((item) => {
          const active = isNavActive(item, pathname);
          const count = item.count ? stats?.counts?.[item.count] : 0;
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                active ? 'bg-accent-soft text-accent-text' : 'text-fg-2 hover:bg-surface-2 hover:text-fg'
              }`}
            >
              <item.icon size={18} />
              <span className="flex-1">{item.label}</span>
              {count > 0 && <span className={`text-xs tabular-nums ${active ? '' : 'text-fg-3'}`}>{count}</span>}
            </Link>
          );
        })}
      </nav>

      <Link to="/settings" className="mt-auto rounded-2xl border border-line bg-surface p-3.5 transition-colors hover:border-line-strong" aria-label="Storage details in Settings">
        <StorageMeter used={Number(user?.storage_used || 0)} limit={Number(user?.storage_limit || 1)} categories={stats?.categories || []} />
      </Link>
    </aside>
  );
};

export default Sidebar

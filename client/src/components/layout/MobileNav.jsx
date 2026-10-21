import { Link, useLocation } from 'react-router-dom'
import { NAV, isNavActive } from './nav'
import NewMenu from './NewMenu'

// Phone tab bar plus the floating "+" button
const MobileNav = () => {
  const { pathname } = useLocation();
  return (
    <>
      <div className="fixed right-4 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-40 lg:hidden">
        <NewMenu variant="fab" align="end" />
      </div>
      <nav
        className="glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid h-16 grid-cols-5 rounded-[22px] px-1 shadow-deep lg:hidden"
        aria-label="Main"
      >
        {NAV.map((item) => {
          const active = isNavActive(item, pathname);
          return (
            <Link
              key={item.to}
              to={item.to}
              aria-current={active ? 'page' : undefined}
              className={`flex flex-col items-center justify-center gap-1 rounded-2xl text-[10.5px] font-medium transition-colors ${active ? 'text-accent-text' : 'text-fg-3'}`}
            >
              <item.icon size={20} strokeWidth={active ? 2.2 : 1.9} />
              {item.short}
            </Link>
          );
        })}
      </nav>
    </>
  );
};

export default MobileNav

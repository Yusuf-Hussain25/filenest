import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import MobileNav from './MobileNav'
import CommandPalette from './CommandPalette'
import UploadPanel from '../drive/UploadPanel'
import DropOverlay from '../drive/DropOverlay'
import { UploadProvider } from '../../context/UploadContext'
import { ActionsProvider } from '../../context/ActionsContext'
import { WorkspaceProvider } from '../../context/WorkspaceContext'

const isTyping = (el) => el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName));

const Shell = () => {
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K anywhere, or "/" when you're not typing, opens search
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      } else if (e.key === '/' && !isTyping(document.activeElement) && !document.querySelector('[role=dialog]')) {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="min-h-dvh">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-lg focus:bg-panel-solid focus:px-3 focus:py-2">Skip to content</a>
      <div className="mx-auto flex max-w-[1680px] gap-6 px-3 sm:px-5 lg:p-3">
        <Sidebar />
        <div className="min-w-0 flex-1">
          <Topbar onSearch={() => setSearchOpen(true)} />
          <main id="main" className="pt-3 pb-40 lg:pt-7 lg:pb-14 lg:pr-3">
            <Outlet />
          </main>
        </div>
      </div>
      <MobileNav />
      <UploadPanel />
      <DropOverlay />
      <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
};

// Signed-in app: uploads, item actions and workspace state wrap every page
const AppLayout = () => (
  <UploadProvider>
    <ActionsProvider>
      <WorkspaceProvider>
        <Shell />
      </WorkspaceProvider>
    </ActionsProvider>
  </UploadProvider>
);

export default AppLayout

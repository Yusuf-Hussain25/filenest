import { useNavigate } from 'react-router-dom'
import { ChevronDownIcon, LogOutIcon, MoonIcon, SearchIcon, SettingsIcon, SunIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from '../ui/Logo'
import Avatar from '../ui/Avatar'
import Menu from '../ui/Menu'
import ThemeToggle from '../ui/ThemeToggle'
import { useAuth } from '../../context/AuthContext'
import { useTheme } from '../../hooks/useTheme'
import { toggleTheme } from '../../lib/theme'

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

// Search trigger (⌘K), theme toggle and the account menu
const Topbar = ({ onSearch }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const theme = useTheme();

  const signOut = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const accountItems = [
    { label: 'Settings', icon: SettingsIcon, onClick: () => navigate('/settings') },
    { label: theme === 'light' ? 'Dark theme' : 'Light theme', icon: theme === 'light' ? MoonIcon : SunIcon, onClick: toggleTheme },
    { separator: true },
    { label: 'Sign out', icon: LogOutIcon, onClick: signOut, danger: true },
  ];

  return (
    <header className="sticky top-0 z-30 -mx-3 mb-2 px-3 pt-3 pb-2 sm:-mx-5 sm:px-5 lg:static lg:mx-0 lg:p-0">
      <div className="glass flex h-14 items-center gap-2 rounded-[20px] px-2.5 shadow-soft lg:h-[60px] lg:px-3">
        <span className="pl-1 lg:hidden"><Logo size={28} /></span>

        <button
          type="button"
          onClick={onSearch}
          className="ml-auto flex h-10 items-center gap-2.5 rounded-xl px-2.5 text-sm text-fg-3 transition-colors hover:bg-surface-2 hover:text-fg-2 sm:w-[340px] sm:border sm:border-line sm:bg-surface sm:px-3.5 lg:ml-0 lg:w-[420px]"
          aria-label="Search files and folders"
        >
          <SearchIcon size={18} />
          <span className="hidden flex-1 text-left sm:inline">Search files and folders</span>
          <span className="kbd hidden sm:inline-grid">{isMac ? '⌘' : 'Ctrl'} K</span>
        </button>

        <div className="flex items-center gap-1 lg:ml-auto">
          <ThemeToggle className="hidden sm:inline-grid" tipPos="bottom" />
          <Menu items={accountItems} label="Account">
            {(props) => (
              <button {...props} type="button" className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition-colors hover:bg-surface-2 sm:pr-2.5" aria-label="Account menu">
                <Avatar name={user?.name} size={32} />
                <span className="hidden max-w-[140px] text-left leading-tight md:block">
                  <span className="block truncate text-[13px] font-semibold">{user?.name}</span>
                  <span className="block truncate text-[11px] text-fg-3">{user?.is_demo ? 'Demo account' : user?.email}</span>
                </span>
                <ChevronDownIcon size={15} className="hidden text-fg-3 md:block" />
              </button>
            )}
          </Menu>
        </div>
      </div>
    </header>
  );
};

export default Topbar

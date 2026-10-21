import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { EyeIcon, EyeOffIcon, HardDriveIcon, KeyRoundIcon, LockKeyholeIcon, LogOutIcon, MoonIcon, PaletteIcon, SunIcon, Trash2Icon, UserRoundIcon } from 'lucide-react'
import api, { errorMessage } from '../config/api'
import { useAuth } from '../context/AuthContext'
import { useWorkspace } from '../context/WorkspaceContext'
import { useTheme } from '../hooks/useTheme'
import { setThemePreference } from '../lib/theme'
import { CATEGORIES } from '../lib/files'
import { formatBytes, formatDate, pluralize } from '../lib/format'
import Avatar from '../components/ui/Avatar'
import StorageMeter from '../components/layout/StorageMeter'

const Section = ({ icon: Icon, title, subtitle, children, className = '' }) => (
  <section className={`card p-5 sm:p-6 ${className}`}>
    <header className="mb-5 flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon size={17} /></span>
      <div>
        <h2 className="font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="text-[13px] text-fg-3">{subtitle}</p>}
      </div>
    </header>
    {children}
  </section>
);

const DemoNote = () => (
  <p className="mb-4 flex items-center gap-2 rounded-xl bg-surface px-3.5 py-2.5 text-[13px] text-fg-2">
    <LockKeyholeIcon size={14} className="shrink-0 text-fg-3" /> Locked on the demo account. Create your own account to change it.
  </p>
);

const ProfileForm = ({ user, onSaved }) => {
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.patch('/api/auth/me', { name: name.trim() });
      onSaved(data.user);
      toast.success('Profile updated');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not update your profile.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="flex items-center gap-4">
        <Avatar name={name || user.name} size={56} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{user.name}</p>
          <p className="truncate text-[13px] text-fg-3">{user.email} · member since {formatDate(user.created_at)}</p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="profile-name">Display name</label>
        <input id="profile-name" className="input" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} disabled={user.is_demo} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="profile-email">Email</label>
        <input id="profile-email" className="input" value={user.email} readOnly disabled />
      </div>
      <button className="btn btn-primary" disabled={busy || user.is_demo || !name.trim() || name.trim() === user.name}>
        {busy && <span className="spinner size-4" />} Save changes
      </button>
    </form>
  );
};

const PasswordForm = ({ disabled }) => {
  const [form, setForm] = useState({ current: '', next: '' });
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.patch('/api/auth/password', { current_password: form.current, new_password: form.next });
      setForm({ current: '', next: '' });
      toast.success('Password changed');
    } catch (err) {
      toast.error(errorMessage(err, 'Could not change your password.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={save} className="space-y-4">
      <div className="field">
        <label htmlFor="pw-current">Current password</label>
        <input id="pw-current" type={show ? 'text' : 'password'} className="input" value={form.current} onChange={(e) => setForm((f) => ({ ...f, current: e.target.value }))} autoComplete="current-password" disabled={disabled} />
      </div>
      <div className="field">
        <label htmlFor="pw-next">New password</label>
        <div className="input-wrap">
          <KeyRoundIcon size={17} />
          <input id="pw-next" type={show ? 'text' : 'password'} className="input pr-12" value={form.next} placeholder="At least 8 characters" onChange={(e) => setForm((f) => ({ ...f, next: e.target.value }))} autoComplete="new-password" disabled={disabled} />
          <button type="button" className="icon-btn icon-btn-sm input-action" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide passwords' : 'Show passwords'} aria-pressed={show} disabled={disabled}>
            {show ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
          </button>
        </div>
      </div>
      <button className="btn btn-primary" disabled={disabled || busy || !form.current || form.next.length < 8}>
        {busy && <span className="spinner size-4" />} Change password
      </button>
    </form>
  );
};

// 14 days of uploads as one-series bars (no legend: the title names it), with a tooltip per day
const UploadChart = ({ days }) => {
  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((n, d) => n + d.count, 0);
  const label = (d) => new Date(`${d.day}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
  return (
    <div>
      <p className="text-[13px] font-medium text-fg-2">Uploads, last 14 days <span className="text-fg-3">· {pluralize(total, 'file')}</span></p>
      <div className="mt-3 flex h-28 items-end gap-1.5 border-b border-line" role="img" aria-label={`Uploads per day for the last 14 days, ${total} in total`}>
        {days.map((d) => (
          <div key={d.day} className="group relative flex h-full flex-1 items-end justify-center" data-tip={`${label(d)}: ${pluralize(d.count, 'file')}${d.size ? `, ${formatBytes(d.size)}` : ''}`}>
            <span
              className="w-full max-w-[22px] rounded-t-[4px] transition-opacity group-hover:opacity-80"
              style={{ height: d.count ? `${Math.max(6, (d.count / max) * 100)}%` : '2px', background: d.count ? 'var(--accent)' : 'var(--surface-3)' }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] text-fg-3">
        <span>{label(days[0])}</span><span>Today</span>
      </div>
      <table className="sr-only">
        <caption>Uploads per day</caption>
        <tbody>{days.map((d) => <tr key={d.day}><td>{label(d)}</td><td>{d.count}</td></tr>)}</tbody>
      </table>
    </div>
  );
};

const Settings = () => {
  const { user, updateUser, logout } = useAuth();
  const { stats } = useWorkspace();
  const theme = useTheme();
  const navigate = useNavigate();

  const signOut = async () => {
    await logout();
    toast.success('Signed out');
    navigate('/login', { replace: true });
  };

  const used = Number(user.storage_used);
  const limit = Number(user.storage_limit);
  const categories = stats?.categories || [];

  return (
    <div className="animate-fade-up">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-[28px]">Settings</h1>
        <p className="mt-1 text-sm text-fg-3">Your profile, security, appearance and storage</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1.1fr]">
        <div className="space-y-4">
          <Section icon={UserRoundIcon} title="Profile" subtitle="How you appear in Filenest and on shared links">
            {user.is_demo && <DemoNote />}
            <ProfileForm key={user.name} user={user} onSaved={(u) => updateUser(u)} />
          </Section>

          <Section icon={KeyRoundIcon} title="Password" subtitle="Use at least 8 characters">
            {user.is_demo && <DemoNote />}
            <PasswordForm disabled={user.is_demo} />
          </Section>

          <Section icon={PaletteIcon} title="Appearance" subtitle="Saved in this browser">
            <div className="segmented" role="group" aria-label="Theme">
              <button type="button" aria-pressed={theme === 'light'} onClick={() => setThemePreference('light')}><SunIcon size={15} /> Light</button>
              <button type="button" aria-pressed={theme === 'dark'} onClick={() => setThemePreference('dark')}><MoonIcon size={15} /> Dark</button>
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section icon={HardDriveIcon} title="Storage" subtitle={`${Math.round((used / limit) * 1000) / 10}% of your space is in use`}>
            <StorageMeter used={used} limit={limit} categories={categories} compact />

            {stats ? (
              <>
                <ul className="mt-5 divide-y divide-line">
                  {Object.entries(CATEGORIES).map(([key, cat]) => {
                    const c = categories.find((x) => x.key === key) || { count: 0, size: 0 };
                    return (
                      <li key={key} className="flex items-center gap-3 py-2.5 text-[13.5px]">
                        <span className="size-2.5 shrink-0 rounded-full" style={{ background: cat.color }} aria-hidden="true" />
                        <span className="flex-1 font-medium">{cat.label}</span>
                        <span className="w-20 text-right text-fg-3 tabular-nums">{pluralize(c.count, 'file')}</span>
                        <span className="w-20 text-right font-medium tabular-nums">{formatBytes(c.size)}</span>
                      </li>
                    );
                  })}
                </ul>

                <div className="mt-6"><UploadChart days={stats.uploads} /></div>

                <div className="mt-6 grid grid-cols-3 gap-2 text-center">
                  {[
                    [stats.counts.folders, 'folders'],
                    [stats.counts.shared, 'active links'],
                    [stats.counts.link_views, 'link opens'],
                  ].map(([n, label]) => (
                    <div key={label} className="rounded-2xl bg-surface px-2 py-3">
                      <p className="text-xl font-semibold tabular-nums">{n}</p>
                      <p className="text-[12px] text-fg-3">{label}</p>
                    </div>
                  ))}
                </div>

                {stats.counts.trash_files > 0 && (
                  <Link to="/trash" className="mt-4 flex items-center gap-3 rounded-2xl border border-line px-4 py-3 text-[13.5px] transition-colors hover:bg-surface-2">
                    <Trash2Icon size={17} className="text-fg-3" />
                    <span className="flex-1">{pluralize(stats.counts.trash_files, 'file')} in the Trash use {formatBytes(stats.counts.trash_size)}</span>
                    <span className="font-medium text-accent-text">Review</span>
                  </Link>
                )}
              </>
            ) : (
              <div className="mt-5 space-y-2.5">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-6" />)}</div>
            )}
          </Section>

          <section className="card flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
            <div>
              <h2 className="font-semibold tracking-tight">Sign out</h2>
              <p className="text-[13px] text-fg-3">Signed in as {user.email}</p>
            </div>
            <button className="btn btn-ghost" onClick={signOut}><LogOutIcon size={16} /> Sign out</button>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Settings

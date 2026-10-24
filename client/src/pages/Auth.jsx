import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { EyeIcon, EyeOffIcon, LockKeyholeIcon, MailIcon, RotateCcwIcon, ShieldCheckIcon, SparklesIcon, UploadCloudIcon, UserRoundIcon, Link2Icon } from 'lucide-react'
import toast from 'react-hot-toast'
import Logo from '../components/ui/Logo'
import ThemeToggle from '../components/ui/ThemeToggle'
import DrivePreview from '../components/auth/DrivePreview'
import { useAuth } from '../context/AuthContext'
import { errorMessage } from '../config/api'

// The server holds the demo credentials; this only decides whether to show the button
const DEMO_ENABLED = Boolean(import.meta.env.VITE_DEMO_EMAIL);

const FEATURES = [
  { icon: UploadCloudIcon, title: 'Drag, drop, done', text: 'Drop files anywhere and watch each one upload with live progress.' },
  { icon: EyeIcon, title: 'Preview anything', text: 'Photos, video, audio, PDFs and text open right in the browser.' },
  { icon: Link2Icon, title: 'Share with control', text: 'Public links that can be view-only, expire, and be revoked.' },
  { icon: RotateCcwIcon, title: 'Trash that forgives', text: 'Restore deleted files and folders right where they were.' },
];

const Auth = ({ mode = 'login' }) => {
  const isRegister = mode === 'register';
  const { user, isLoading, login, register, demoLogin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(null); // 'form' | 'demo' | null
  const [error, setError] = useState('');

  // Back to the page that sent us here, if any
  const destination = location.state?.from?.pathname && location.state.from.pathname !== '/login'
    ? `${location.state.from.pathname}${location.state.from.search || ''}`
    : '/';

  if (!isLoading && user) {
    return <Navigate to={destination} replace />;
  }

  const update = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError('');
  };

  const switchMode = (next) => {
    setError('');
    navigate(next === 'register' ? '/register' : '/login', { replace: true, state: location.state });
  };

  const submit = async (e) => {
    e.preventDefault();
    if (isRegister && form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy('form');
    try {
      if (isRegister) {
        const u = await register(form.name.trim(), form.email.trim(), form.password);
        toast.success(`Welcome to Filenest, ${u.name.split(' ')[0]}!`);
      } else {
        const u = await login(form.email.trim(), form.password);
        toast.success(`Welcome back, ${u.name.split(' ')[0]}`);
      }
      navigate(destination, { replace: true });
    } catch (err) {
      setError(errorMessage(err, isRegister ? 'Could not create your account.' : 'Could not log you in.'));
      setBusy(null);
    }
  };

  const openDemo = async () => {
    setBusy('demo');
    try {
      await demoLogin();
      toast.success('Signed in to the demo account');
      navigate('/', { replace: true });
    } catch (err) {
      toast.error(errorMessage(err, 'Could not open the demo account.'));
      setBusy(null);
    }
  };

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-5 sm:px-8">
        <Logo size={30} />
        <ThemeToggle tipPos="bottom" />
      </header>

      {/* Mobile order: headline, auth card, preview. Desktop: hero left, card right. */}
      <main className="mx-auto grid w-full max-w-7xl gap-8 px-4 pb-16 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-x-14 lg:pt-4">
        <section className="animate-fade-up lg:col-start-1 lg:row-start-1">
          <span className="chip chip-accent"><SparklesIcon size={13} /> Your files, organised and shareable</span>
          <h1 className="mt-5 text-[40px] leading-[1.04] font-semibold tracking-[-0.04em] sm:text-[56px]">
            Your files,<br /> <span className="gradient-text">safely nested.</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-fg-2 sm:text-lg">
            Upload, organise and preview everything in one calm place, then share exactly what you want with links you control.
          </p>
        </section>

        <section className="animate-fade-up [animation-delay:.08s] lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="card mx-auto w-full max-w-[460px] p-5 shadow-deep sm:p-7">
            <div className="segmented mb-6 w-full" role="group" aria-label="Choose log in or sign up">
              <button type="button" aria-pressed={!isRegister} className="flex-1 justify-center" onClick={() => switchMode('login')}>Log in</button>
              <button type="button" aria-pressed={isRegister} className="flex-1 justify-center" onClick={() => switchMode('register')}>Sign up</button>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h2>
            <p className="mt-1 text-sm text-fg-3">
              {isRegister ? '1 GB of free space, ready in seconds.' : 'Log in to get to your files.'}
            </p>

            <form className="mt-6 space-y-4" onSubmit={submit} noValidate>
              {isRegister && (
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <div className="input-wrap">
                    <UserRoundIcon size={17} />
                    <input id="name" className="input" autoComplete="name" placeholder="Your name" value={form.name} onChange={update('name')} required maxLength={80} />
                  </div>
                </div>
              )}
              <div className="field">
                <label htmlFor="email">Email</label>
                <div className="input-wrap">
                  <MailIcon size={17} />
                  <input id="email" type="email" className="input" autoComplete="email" placeholder="you@example.com" value={form.email} onChange={update('email')} required />
                </div>
              </div>
              <div className="field">
                <label htmlFor="password">Password</label>
                <div className="input-wrap">
                  <LockKeyholeIcon size={17} />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    className="input pr-12"
                    autoComplete={isRegister ? 'new-password' : 'current-password'}
                    placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                    value={form.password}
                    onChange={update('password')}
                    required
                  />
                  <button
                    type="button"
                    className="icon-btn icon-btn-sm input-action"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                  >
                    {showPassword ? <EyeOffIcon size={17} /> : <EyeIcon size={17} />}
                  </button>
                </div>
              </div>

              {error && (
                <p role="alert" className="rounded-xl border border-danger/25 bg-danger/10 px-3.5 py-2.5 text-[13px] text-danger">{error}</p>
              )}

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-block"
                disabled={Boolean(busy) || !form.email || !form.password || (isRegister && !form.name.trim())}
              >
                {busy === 'form' && <span className="spinner" />}
                {busy === 'form' ? (isRegister ? 'Creating account…' : 'Logging in…') : isRegister ? 'Create account' : 'Log in'}
              </button>
            </form>

            {DEMO_ENABLED && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-fg-3">
                  <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
                </div>
                <button className="btn btn-ghost btn-block" onClick={openDemo} disabled={Boolean(busy)}>
                  {busy === 'demo' ? <span className="spinner" /> : <SparklesIcon size={17} className="text-accent-text" />}
                  {busy === 'demo' ? 'Opening demo…' : 'Explore with a demo account'}
                </button>
              </>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-fg-3">
              <ShieldCheckIcon size={13} /> Your files stay private until you share a link
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-12 animate-fade-up [animation-delay:.12s] lg:col-start-1 lg:row-start-2">
          <div className="px-1 pt-4 pb-4 sm:px-4">
            <DrivePreview />
          </div>

          <ul className="grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <li key={title} className="card flex gap-3 rounded-[20px] p-4">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-text"><Icon size={17} /></span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="mt-0.5 text-[13px] leading-snug text-fg-3">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </div>
  );
};

export default Auth

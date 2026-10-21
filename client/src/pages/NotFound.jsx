import { Link } from 'react-router-dom'
import { CompassIcon } from 'lucide-react'
import Logo from '../components/ui/Logo'
import EmptyState from '../components/ui/EmptyState'

// Any address that isn't a Filenest page
const NotFound = () => (
  <div className="min-h-dvh">
    <header className="mx-auto flex max-w-6xl px-4 py-5 sm:px-8">
      <Link to="/" aria-label="Filenest home"><Logo size={30} /></Link>
    </header>
    <main className="mx-auto max-w-xl px-4">
      <div className="card mt-10 animate-fade-up">
        <EmptyState icon={<CompassIcon size={26} />} title="This page doesn't exist" action={<Link to="/" className="btn btn-primary">Go to my files</Link>}>
          The address may be mistyped, or the page has moved.
        </EmptyState>
      </div>
    </main>
  </div>
);

export default NotFound

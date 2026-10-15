import { Link } from 'react-router-dom'
import { buttonClass } from '../components/ui'

export default function Landing() {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-4">
        <span className="text-xl font-semibold tracking-tight">myanimate</span>

        <nav className="flex items-center gap-2">
          <Link to="/login" className={buttonClass.secondary}>
            Sign in
          </Link>
          <Link to="/signup" className={buttonClass.primary}>
            Sign up
          </Link>
        </nav>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <h1 className="max-w-2xl text-4xl font-semibold tracking-tight sm:text-5xl">
          Describe it. Watch it move.
        </h1>

        <p className="mt-5 max-w-xl text-base text-zinc-600">
          myanimate turns a plain-English prompt into a finished animated video. Choose Manim for
          maths and explainer scenes or Remotion for motion graphics, type what you want to see, and
          get a video back in minutes. No timeline, no keyframes, no code.
        </p>
      </main>
    </div>
  )
}

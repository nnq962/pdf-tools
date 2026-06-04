import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-950 px-6 text-center text-white">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-cyan-300">
          Tailwind CSS is ready
        </p>
        <h1 className="mt-3 text-4xl font-bold sm:text-5xl">PDF Tool</h1>
      </div>

      <button
        type="button"
        className="rounded-md bg-cyan-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-200 focus:ring-offset-2 focus:ring-offset-slate-950"
        onClick={() => setCount((count) => count + 1)}
      >
        Count is {count}
      </button>
    </main>
  )
}

export default App

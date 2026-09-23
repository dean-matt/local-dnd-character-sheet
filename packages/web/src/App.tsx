export function App() {
  return (
    <main className="min-h-screen bg-canvas p-8 text-ink">
      <h1 className="font-semibold text-2xl">local-dnd-character-sheet</h1>
      <p className="mt-2 text-muted text-row">Scaffold. See the milestones for what lands next.</p>

      <section className="mt-6 w-64 rounded-card border border-border bg-surface p-3">
        <h2 className="font-semibold text-muted text-row uppercase tracking-wide">Example</h2>
        <div className="mt-2 flex h-row items-center justify-between border-border border-t">
          <span className="text-row">Strength</span>
          <span className="font-bold text-number">+2</span>
        </div>
        <button
          type="button"
          className="mt-2 rounded-full bg-accent px-3 py-1 font-semibold text-row text-white hover:bg-accent-hover active:bg-accent-active"
        >
          Roll
        </button>
      </section>
    </main>
  );
}

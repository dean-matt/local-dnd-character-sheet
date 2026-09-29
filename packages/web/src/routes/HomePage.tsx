import { Link } from "react-router";

/** A placeholder until the homepage has content of its own. */
export function HomePage() {
  return (
    <section>
      <h1 className="font-semibold text-2xl">Local D&D</h1>
      <Link to="/characters" className="mt-2 inline-block text-accent underline">
        Your characters
      </Link>
    </section>
  );
}

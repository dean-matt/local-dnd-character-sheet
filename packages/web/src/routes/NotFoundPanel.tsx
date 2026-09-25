import { Link } from "react-router";

/** `lookedFor` names what a stale link asked for, since the address alone is hard to read. */
export function NotFoundPanel({ lookedFor }: { lookedFor?: string }) {
  return (
    <section>
      <h1 className="font-semibold text-2xl">Page not found</h1>
      <p className="mt-2 text-muted text-row">
        {lookedFor ? `Nothing answers to ${lookedFor}.` : "Nothing lives at this address."}{" "}
        <Link to="/" className="text-accent underline">
          Back to your characters
        </Link>
        .
      </p>
    </section>
  );
}

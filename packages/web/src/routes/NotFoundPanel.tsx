import { Link } from "react-router";

export function NotFoundPanel() {
  return (
    <section>
      <h1 className="font-semibold text-2xl">Page not found</h1>
      <p className="mt-2 text-muted text-row">
        Nothing lives at this address.{" "}
        <Link to="/" className="text-accent underline">
          Back to your characters
        </Link>
        .
      </p>
    </section>
  );
}

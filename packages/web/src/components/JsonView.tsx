import { ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useId, useState } from "react";

/**
 * A row's JSON, pretty-printed and read-only, behind a toggle that starts closed. It shows
 * `JSON.stringify` of the row and nothing the row lacks.
 */
export function JsonView({ json }: { json: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState("");
  const regionId = useId();
  const text = JSON.stringify(json, null, 2);
  const Chevron = open ? ChevronDown : ChevronRight;

  // Cleared first so a second copy changes the live region and is announced again.
  const copy = async () => {
    setStatus("");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
    } catch {
      setStatus("Could not copy");
    }
  };

  return (
    <div className="mt-2 border-border border-t pt-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          aria-expanded={open}
          aria-controls={regionId}
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 rounded-control text-muted text-row hover:text-body"
        >
          <Chevron size={16} aria-hidden="true" />
          JSON
        </button>
        {open && (
          <button
            type="button"
            onClick={copy}
            className="flex items-center gap-1 rounded-control text-muted text-row hover:text-body"
          >
            <Copy size={14} aria-hidden="true" />
            Copy JSON
          </button>
        )}
      </div>
      <p role="status" className="sr-only">
        {status}
      </p>
      {open && (
        <section id={regionId} aria-label="Row JSON">
          <pre className="mt-2 whitespace-pre-wrap break-words rounded-control bg-subtle p-3 text-label">
            <code>{text}</code>
          </pre>
        </section>
      )}
    </div>
  );
}

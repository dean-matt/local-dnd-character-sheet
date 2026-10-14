import { Copy } from "lucide-react";
import { useState } from "react";

export function AppVersion() {
  const text = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_COMMIT})`;
  const [status, setStatus] = useState("");

  // Cleared first so a second copy changes the live region and is announced again.
  const copy = async () => {
    setStatus("");
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied");
    } catch {
      setStatus("Could not copy. Select the version instead.");
    }
  };

  return (
    <div>
      <p className="mb-2.5 font-semibold text-label text-muted uppercase tracking-label">Version</p>
      <div className="flex items-center gap-2">
        <code className="select-all text-body text-ink">{text}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy version"
          className="flex items-center gap-1 rounded-control px-2 py-1 font-semibold text-body text-muted hover:bg-subtle"
        >
          <Copy size={14} />
          Copy
        </button>
      </div>
      <p role="status" className="mt-1.5 text-label text-muted">
        {status}
      </p>
    </div>
  );
}

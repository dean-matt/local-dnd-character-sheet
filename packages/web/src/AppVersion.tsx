import { Copy } from "lucide-react";
import { useState } from "react";

export function AppVersion() {
  const text = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_COMMIT})`;
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <div>
      <p className="mb-2.5 font-semibold text-label text-muted uppercase tracking-label">Version</p>
      <div className="flex items-center gap-2">
        <code className="text-body text-ink">{text}</code>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy version"
          className="flex items-center gap-1 rounded-control px-2 py-1 font-semibold text-body text-muted hover:bg-subtle"
        >
          <Copy size={14} />
          Copy
        </button>
        <span role="status" className="text-label text-muted">
          {copied ? "Copied" : ""}
        </span>
      </div>
    </div>
  );
}

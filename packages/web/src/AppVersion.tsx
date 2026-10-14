import { Check, CircleAlert, Tag } from "lucide-react";
import { useEffect, useState } from "react";

const SHOWN_MS = 2000;

/** The build's version and commit as a rail row that copies them on click. */
export function AppVersion({ collapsed }: { collapsed: boolean }) {
  const text = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_COMMIT})`;
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!status) return;
    const timer = setTimeout(() => setStatus(""), SHOWN_MS);
    return () => clearTimeout(timer);
  }, [status]);

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

  const Result = status === "Copied" ? Check : CircleAlert;
  const result = status && (
    <Result
      size={collapsed ? 19 : 16}
      aria-hidden="true"
      className={`shrink-0 ${status === "Copied" ? "text-positive" : "text-error"}`}
    />
  );

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        aria-label={collapsed ? `Copy version ${text}` : undefined}
        title="Copy version"
        className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
      >
        {collapsed ? (
          result || <Tag size={19} aria-hidden="true" className="shrink-0" />
        ) : (
          <>
            <Tag size={19} aria-hidden="true" className="shrink-0" />
            <code className="truncate text-label">{text}</code>
            {result}
          </>
        )}
      </button>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}

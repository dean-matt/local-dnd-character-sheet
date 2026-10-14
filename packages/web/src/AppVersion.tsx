import { Check, CircleAlert, Tag } from "lucide-react";
import { useState } from "react";

/** The build's version and commit as a rail row that copies them on click. */
export function AppVersion({ collapsed }: { collapsed: boolean }) {
  const text = `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_COMMIT})`;
  const [status, setStatus] = useState("");
  const Icon = status === "" ? Tag : status === "Copied" ? Check : CircleAlert;

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
      <button
        type="button"
        onClick={copy}
        aria-label={collapsed ? `Copy version ${text}` : undefined}
        title={status || "Copy version"}
        className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
      >
        <Icon size={19} aria-hidden="true" className="shrink-0" />
        {!collapsed && <code className="select-all truncate text-label">{text}</code>}
      </button>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}

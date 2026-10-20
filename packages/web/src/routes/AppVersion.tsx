import { Check, CircleAlert, Tag } from "lucide-react";
import { useEffect, useState } from "react";
import { appVersionText } from "./appVersionText.ts";

const SHOWN_MS = 2000;

/** The build's version and commit as a rail row that copies them on click. */
export function AppVersion({ collapsed }: { collapsed: boolean }) {
  const text = appVersionText();
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
  const tone = status === "Copied" ? "text-positive" : "text-error";
  // Every label shares one grid cell and only the current one is opaque, so the row keeps
  // the width of the longest, nothing beside it moves, and the labels cross-fade.
  const labels = [
    { label: text, tone: "" },
    { label: "Copied", tone: "text-positive" },
    { label: "Could not copy", tone: "text-error" },
  ];

  return (
    <div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy version ${text}`}
        title={`Copy version ${text}`}
        className={`flex w-full items-center gap-3 rounded-control px-2.5 py-2.5 text-muted hover:bg-subtle ${collapsed ? "justify-center" : ""}`}
      >
        {collapsed && status ? (
          <Result size={19} aria-hidden="true" className={`shrink-0 ${tone}`} />
        ) : (
          <Tag size={19} aria-hidden="true" className="shrink-0" />
        )}
        {!collapsed && (
          <span className="grid min-w-0 text-left">
            {labels.map(({ label, tone }) => {
              const shown = label === (status || text);
              return (
                <code
                  key={label}
                  aria-hidden={!shown || undefined}
                  className={`col-start-1 row-start-1 truncate text-label ${tone} ${shown ? "opacity-100" : "opacity-0"}`}
                  style={{ transition: "opacity var(--duration-quick)" }}
                >
                  {label}
                </code>
              );
            })}
          </span>
        )}
      </button>
      <p role="status" className="sr-only">
        {status}
      </p>
    </div>
  );
}

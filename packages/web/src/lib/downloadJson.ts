/** Hands `value` to the browser as a pretty-printed JSON download named `filename`. */
export function downloadJson(value: unknown, filename: string) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // A revoke in the same task can cancel the download in some browsers before it starts.
  setTimeout(() => URL.revokeObjectURL(url));
}

/** The build's version and commit as one line, such as `0.5.1 (41d05f0)`. */
export function appVersionText(): string {
  return `${import.meta.env.VITE_APP_VERSION} (${import.meta.env.VITE_APP_COMMIT})`;
}

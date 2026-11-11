/** When a session log entry happened: the date and the time, in the reader's locale. */
export const when = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

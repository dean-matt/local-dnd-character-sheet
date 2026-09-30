import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lays nothing out and logs on every call to this, which `RootLayout` makes per navigation.
window.scrollTo = () => {};
// jsdom ships no ResizeObserver, and with no layout there is no size change to report.
window.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

afterEach(cleanup);

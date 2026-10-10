import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lays nothing out and logs on every call to this, which `RootLayout` makes per navigation.
window.scrollTo = () => {};

// jsdom has no layout to observe; `CreationFlow` measures its footer with this.
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// A routed page took 1.2 s on a hosted Windows runner, past the 1 s default. 3 s is
// 2.5 times that and under the 5 s test timeout, so a page that never renders fails
// here with the query that timed out rather than as a bare test timeout.
configure({ asyncUtilTimeout: 3_000 });

afterEach(cleanup);

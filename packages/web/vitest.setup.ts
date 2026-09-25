import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lays nothing out and logs on every call to this, which `RootLayout` makes per navigation.
window.scrollTo = () => {};

afterEach(cleanup);

import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom lays nothing out and logs on every `ScrollRestoration` call to this.
window.scrollTo = () => {};

afterEach(cleanup);

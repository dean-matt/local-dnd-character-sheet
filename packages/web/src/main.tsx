import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import "@fontsource-variable/noto-sans/wght.css";
import { refreshStoredAccent } from "./accent.ts";
import { isCatalogOutOfDate } from "./lib/api.ts";
import "./index.css";
import { router } from "./router.tsx";

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element");

refreshStoredAccent();

// A stale catalog stays stale until a rebuild, so retrying only delays the banner.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: (failures, error) => !isCatalogOutOfDate(error) && failures < 3 },
  },
});

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

import type { RouteObject } from "react-router";
import { createBrowserRouter } from "react-router";
import { CATALOG_TARGETS } from "./lib/catalogRows.ts";
import { CatalogPage } from "./routes/CatalogPage.tsx";
import { CharacterLayout } from "./routes/CharacterLayout.tsx";
import { CharacterListPage } from "./routes/CharacterListPage.tsx";
import { CharacterPage } from "./routes/CharacterPage.tsx";
import { CharacterRedirect } from "./routes/CharacterRedirect.tsx";
import { NotFoundPanel } from "./routes/NotFoundPanel.tsx";
import { RootLayout } from "./routes/RootLayout.tsx";

export const routeConfig: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      { index: true, element: <CharacterListPage /> },
      {
        path: "characters/:id",
        element: <CharacterLayout />,
        children: [
          { index: true, element: <CharacterRedirect /> },
          { path: "p/:slug", element: <CharacterPage /> },
        ],
      },
      ...CATALOG_TARGETS.map((target) => ({
        path: `catalog/${target.path}`,
        element: <CatalogPage target={target} />,
      })),
      { path: "*", element: <NotFoundPanel /> },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);

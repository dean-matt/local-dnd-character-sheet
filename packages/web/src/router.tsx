import type { RouteObject } from "react-router";
import { createBrowserRouter } from "react-router";
import { CATALOG_TARGETS } from "./lib/catalogRows.ts";
import { CatalogPage } from "./routes/CatalogPage.tsx";
import { CharacterLayout } from "./routes/CharacterLayout/CharacterLayout.tsx";
import { CharacterListPage } from "./routes/CharacterListPage/CharacterListPage.tsx";
import { CharacterPage } from "./routes/CharacterPage.tsx";
import { CharacterRedirect } from "./routes/CharacterRedirect.tsx";
import { ContentLayout } from "./routes/ContentLayout.tsx";
import { DisplaySettings } from "./routes/DisplaySettings.tsx";
import { HomePage } from "./routes/HomePage.tsx";
import { NotFoundPanel } from "./routes/NotFoundPanel.tsx";
import { RootLayout } from "./routes/RootLayout/RootLayout.tsx";
import { SettingsLayout } from "./routes/SettingsLayout.tsx";

export const routeConfig: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <ContentLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "characters", element: <CharacterListPage /> },
          ...CATALOG_TARGETS.map((target) => ({
            path: `catalog/${target.path}`,
            element: <CatalogPage target={target} />,
          })),
          { path: "*", element: <NotFoundPanel /> },
        ],
      },
      {
        path: "characters/:id",
        element: <CharacterLayout />,
        children: [
          { index: true, element: <CharacterRedirect /> },
          { path: "p/:slug", element: <CharacterPage /> },
        ],
      },
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [{ index: true, element: <DisplaySettings /> }],
      },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);

import type { RouteObject } from "react-router";
import { createBrowserRouter, Link, Outlet } from "react-router";
import { CATALOG_TARGETS } from "./lib/catalogRows.ts";
import { CatalogPage } from "./routes/CatalogPage.tsx";
import { CharacterLayout } from "./routes/CharacterLayout.tsx";
import { CharacterListPage } from "./routes/CharacterListPage.tsx";
import { CharacterPage } from "./routes/CharacterPage.tsx";
import { CharacterRedirect } from "./routes/CharacterRedirect.tsx";
import { NotFoundPanel } from "./routes/NotFoundPanel.tsx";
import { RootLayout } from "./routes/RootLayout.tsx";
import { DisplaySettings, SettingsLayout } from "./routes/Settings.tsx";

/** Adds the default content padding for routes that do not manage their own layout. */
function ContentLayout() {
  return (
    <div className="px-gutter py-6">
      <Outlet />
    </div>
  );
}

/** A placeholder until the homepage has content of its own. */
function HomePage() {
  return (
    <section>
      <h1 className="font-semibold text-2xl">Local D&D</h1>
      <Link to="/characters" className="mt-2 inline-block text-accent underline">
        Your characters
      </Link>
    </section>
  );
}

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

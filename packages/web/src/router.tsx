import type { RouteObject } from "react-router";
import { createBrowserRouter } from "react-router";
import { CharacterLayout } from "./routes/CharacterLayout/CharacterLayout.tsx";
import { CharacterListPage } from "./routes/CharacterListPage/CharacterListPage.tsx";
import { CharacterPage } from "./routes/CharacterPage.tsx";
import { CharacterRedirect } from "./routes/CharacterRedirect.tsx";
import { ContentLayout } from "./routes/ContentLayout.tsx";
import { CreationFlow } from "./routes/CreationFlow/CreationFlow.tsx";
import { DisplaySettings } from "./routes/DisplaySettings.tsx";
import { HomebrewSettings } from "./routes/HomebrewSettings/HomebrewSettings.tsx";
import { HomePage } from "./routes/HomePage/HomePage.tsx";
import { NotFoundPanel } from "./routes/NotFoundPanel.tsx";
import { RootLayout } from "./routes/RootLayout/RootLayout.tsx";
import { SearchPage } from "./routes/SearchPage/SearchPage.tsx";
import { SettingsLayout } from "./routes/SettingsLayout.tsx";
import { SourcesSettings } from "./routes/SourcesSettings/SourcesSettings.tsx";

export const routeConfig: RouteObject[] = [
  {
    element: <RootLayout />,
    children: [
      {
        element: <ContentLayout />,
        children: [
          { index: true, element: <HomePage /> },
          { path: "characters", element: <CharacterListPage /> },
          { path: "*", element: <NotFoundPanel /> },
        ],
      },
      { path: "characters/new", element: <CreationFlow /> },
      {
        path: "characters/:id",
        element: <CharacterLayout />,
        children: [
          { index: true, element: <CharacterRedirect /> },
          { path: "p/:slug", element: <CharacterPage /> },
        ],
      },
      { path: "search", element: <SearchPage /> },
      {
        path: "settings",
        element: <SettingsLayout />,
        children: [
          { index: true, element: <DisplaySettings /> },
          { path: "sources", element: <SourcesSettings /> },
          { path: "homebrew", element: <HomebrewSettings /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routeConfig);

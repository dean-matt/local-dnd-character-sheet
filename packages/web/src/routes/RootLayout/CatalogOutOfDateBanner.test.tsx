import { CATALOG_OUT_OF_DATE } from "@dnd/catalog";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ErrorState } from "../../ErrorState.tsx";
import { ApiError } from "../../lib/api.ts";
import { CatalogOutOfDateBanner } from "./CatalogOutOfDateBanner.tsx";

function Widget({ fails }: { fails: ApiError }) {
  const query = useQuery({
    queryKey: [fails.message],
    queryFn: () => Promise.reject(fails),
    retry: false,
  });
  return query.isError ? <ErrorState error={query.error} /> : null;
}

function renderWith(...failures: ApiError[]) {
  const client = new QueryClient();
  return render(
    <QueryClientProvider client={client}>
      <CatalogOutOfDateBanner />
      {failures.map((fails) => (
        <Widget key={fails.message} fails={fails} />
      ))}
    </QueryClientProvider>,
  );
}

describe("CatalogOutOfDateBanner", () => {
  it("names the rebuild once, in place of each widget's error", async () => {
    const outOfDate = new ApiError(CATALOG_OUT_OF_DATE, 503, undefined, {
      error: CATALOG_OUT_OF_DATE,
      code: "catalog_out_of_date",
    });
    renderWith(outOfDate);

    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent(CATALOG_OUT_OF_DATE.replaceAll("`", ""));
    expect(banner.querySelector("code")).toHaveTextContent("pnpm content:build");
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("stays away for any other failure, which its widget reports", async () => {
    renderWith(new ApiError("No catalog has been built yet", 503, undefined, { error: "x" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("No catalog has been built yet");
    expect(screen.getByRole("alert").querySelector("code")).toBeNull();
  });
});

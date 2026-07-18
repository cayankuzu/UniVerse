import { QueryClient } from "@tanstack/react-query";
import { projectionKeys } from "./projectionKeys";
import {
  applyProjectionEnvelope,
  getProjectionState,
  prependProjectionItem,
  readProjectionItems,
  removeProjectionItemIds,
  replaceProjectionItemId,
} from "./projections";

type Item = { id: string; title: string };

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

describe("projection helpers", () => {
  it("writes entity cache and screen state from an envelope", () => {
    const queryClient = createQueryClient();
    const screenKey = ["screen", "home", "viewer"];
    applyProjectionEnvelope<Item>({
      entity: "home-feed",
      envelope: {
        deltaToken: "delta-1",
        items: [{ id: "1", title: "One" }],
        nextCursor: "cursor-2",
        serverTime: "2026-03-12T00:00:00.000Z",
      },
      mode: "replace",
      queryClient,
      screenKey,
    });

    expect(getProjectionState(queryClient, screenKey)?.ids).toEqual(["1"]);
    expect(queryClient.getQueryData(projectionKeys.entity("home-feed", "1"))).toEqual({
      id: "1",
      title: "One",
    });
    expect(readProjectionItems<Item>(queryClient, screenKey, "home-feed")).toEqual([
      { id: "1", title: "One" },
    ]);
  });

  it("supports prepend, replace-id and remove flows generically", () => {
    const queryClient = createQueryClient();
    const screenKey = ["screen", "notifications", "viewer"];

    applyProjectionEnvelope<Item>({
      entity: "notifications",
      envelope: {
        items: [{ id: "1", title: "First" }],
        nextCursor: null,
        serverTime: "2026-03-12T00:00:00.000Z",
      },
      mode: "replace",
      queryClient,
      screenKey,
    });

    prependProjectionItem({
      entity: "notifications",
      item: { id: "2", title: "Second" },
      queryClient,
      screenKey,
    });
    expect(getProjectionState(queryClient, screenKey)?.ids).toEqual(["2", "1"]);

    replaceProjectionItemId({
      entity: "notifications",
      nextItem: { id: "server-2", title: "Second" },
      previousId: "2",
      queryClient,
      screenKey,
    });
    expect(getProjectionState(queryClient, screenKey)?.ids).toEqual(["server-2", "1"]);

    removeProjectionItemIds({
      entity: "notifications",
      ids: ["1"],
      queryClient,
      screenKey,
    });
    expect(getProjectionState(queryClient, screenKey)?.ids).toEqual(["server-2"]);
  });
});

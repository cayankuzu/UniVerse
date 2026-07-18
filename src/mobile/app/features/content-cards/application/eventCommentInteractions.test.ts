import type { SetStateAction } from "react";
import type { CommentItem } from "../data";
import { toggleEventCommentLike } from "./eventCommentInteractions";
import { toggleEventCommentLike as persistEventCommentLike } from "../data";

jest.mock("../data", () => ({
  fetchEventCommentLikers: jest.fn(),
  toggleEventCommentLike: jest.fn(),
}));

function createSetCommentsHarness(initialState: CommentItem[]) {
  let state = initialState;
  return {
    getState: () => state,
    setComments: (updater: SetStateAction<CommentItem[]>) => {
      state = typeof updater === "function" ? updater(state) : updater;
    },
  };
}

describe("toggleEventCommentLike", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("keeps optimistic local comments local until the real comment id exists", async () => {
    const comment = {
      id: "local-1",
      likedByViewer: false,
      likesCount: 0,
    } as CommentItem;
    const harness = createSetCommentsHarness([comment]);

    await toggleEventCommentLike(comment, harness.setComments);

    expect(persistEventCommentLike).not.toHaveBeenCalled();
    expect(harness.getState()[0]).toMatchObject({
      likedByViewer: true,
      likesCount: 1,
    });
  });

  it("ignores duplicate taps while the same like request is already in flight", async () => {
    const comment = {
      id: "comment-1",
      likedByViewer: false,
      likesCount: 0,
    } as CommentItem;
    const harness = createSetCommentsHarness([comment]);
    const inFlightIds = new Set<string>(["comment-1"]);

    await toggleEventCommentLike(comment, harness.setComments, inFlightIds);

    expect(persistEventCommentLike).not.toHaveBeenCalled();
    expect(harness.getState()[0]).toMatchObject({
      likedByViewer: false,
      likesCount: 0,
    });
  });

  it("applies the server result for persisted comments", async () => {
    const comment = {
      id: "comment-1",
      likedByViewer: false,
      likesCount: 0,
    } as CommentItem;
    const harness = createSetCommentsHarness([comment]);

    (persistEventCommentLike as jest.Mock).mockResolvedValue({
      count: 4,
      liked: true,
    });

    await toggleEventCommentLike(comment, harness.setComments, new Set<string>());

    expect(persistEventCommentLike).toHaveBeenCalledWith("comment-1", {
      desiredLiked: true,
    });
    expect(harness.getState()[0]).toMatchObject({
      likedByViewer: true,
      likesCount: 4,
    });
  });
});

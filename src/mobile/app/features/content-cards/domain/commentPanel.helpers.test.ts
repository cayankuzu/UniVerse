import { buildOptimisticComment, normalizeParentId } from "./commentPanel.helpers";
import { formatAbsoluteDateTime } from "../../../shared/utils/dateTime";

describe("CommentPanel helpers", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("normalizes empty parent ids to null", () => {
    expect(normalizeParentId("")).toBeNull();
    expect(normalizeParentId(" null ")).toBeNull();
  });

  it("builds an optimistic comment from the current user", () => {
    jest.spyOn(Date, "now").mockReturnValue(1234);
    jest.spyOn(Math, "random").mockReturnValue(0.5);
    const optimisticComment = buildOptimisticComment({
      parentId: " parent-1 ",
      text: "Merhaba",
      user: {
        id: "user-1",
        profileImage: "avatar.png",
        university: "Bogazici",
        username: "cayan",
      },
    });

    expect(optimisticComment).toMatchObject({
      id: expect.stringContaining("local-1234-"),
      image: "avatar.png",
      likedByViewer: false,
      likesCount: 0,
      name: "cayan",
      parentId: "parent-1",
      text: "Merhaba",
      university: "Bogazici",
      userId: "user-1",
      username: "cayan",
    });
    expect(optimisticComment.time).toBe(formatAbsoluteDateTime(optimisticComment.createdAt));
  });
});

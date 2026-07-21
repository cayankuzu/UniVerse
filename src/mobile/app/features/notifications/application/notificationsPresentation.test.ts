import {
  getNotificationIconBg,
  mapNotificationIcon,
  toFilterCategory,
} from "./notificationsPresentation";
import { tokens } from "../../../shared/theme";

describe("notificationsPresentation", () => {
  it.each([
    ["follow_request", "social"],
    ["follow", "social"],
    ["follow_accepted", "social"],
    ["like", "like"],
    ["comment", "comment"],
    ["event", "club"],
    ["join", "club"],
    ["join_request", "club"],
    ["join_accepted", "club"],
    ["join_rejected", "club"],
    ["system", "club"],
    ["unknown", "all"],
  ] as const)("maps %s to the %s notification filter", (type, expected) => {
    expect(toFilterCategory(type)).toBe(expected);
    expect(mapNotificationIcon(type)).toEqual(expect.anything());
    expect(getNotificationIconBg(type)).toEqual(expect.any(String));
  });

  it("uses distinct emphasis colors for comments, likes, social updates, and club updates", () => {
    expect(getNotificationIconBg("comment")).toBe(tokens.colors.primarySoft);
    expect(getNotificationIconBg("like")).toBe(tokens.colors.dangerSurface);
    expect(getNotificationIconBg("follow")).toBe(tokens.colors.primarySofter);
    expect(getNotificationIconBg("event")).toBe(tokens.colors.surfaceVariant);
  });
});

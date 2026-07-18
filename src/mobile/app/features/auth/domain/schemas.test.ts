import { TEXT_LIMITS } from "../../../shared/validation/textLimits";
import {
  clubRegisterSchema,
  forgotPasswordSchema,
  loginSchema,
  studentRegisterSchema,
} from "./schemas";

describe("auth schemas", () => {
  const baseStudent = {
    bio: "",
    department: "",
    email: "student@kampus.edu.tr",
    gradeYear: "",
    name: "Test User",
    password: "Password10",
    university: "Test University",
    username: "testuser",
  };

  const baseClub = {
    clubName: "Test Club",
    description: "",
    email: "club@kampus.edu.tr",
    password: "Password10",
    university: "Test University",
    username: "testclub",
  };

  it("rejects student bios above the shared limit", () => {
    expect(
      studentRegisterSchema.safeParse({
        ...baseStudent,
        bio: "a".repeat(TEXT_LIMITS.auth.bio + 1),
      }).success,
    ).toBe(false);
  });

  it("rejects club descriptions above the shared limit", () => {
    expect(
      clubRegisterSchema.safeParse({
        ...baseClub,
        description: "a".repeat(TEXT_LIMITS.auth.clubDescription + 1),
      }).success,
    ).toBe(false);
  });

  it("accepts common email domains", () => {
    expect(
      studentRegisterSchema.safeParse({
        ...baseStudent,
        email: "student@gmail.com",
      }).success,
    ).toBe(true);
    expect(
      clubRegisterSchema.safeParse({
        ...baseClub,
        email: "club@hotmail.com",
      }).success,
    ).toBe(true);
    expect(
      loginSchema.safeParse({
        email: "user@gmail.com",
        password: "Password10",
      }).success,
    ).toBe(true);
    expect(
      forgotPasswordSchema.safeParse({
        email: "user@yahoo.com",
      }).success,
    ).toBe(true);
  });

  it("keeps registration schemas single-password without confirmPassword", () => {
    expect(
      studentRegisterSchema.parse({
        ...baseStudent,
        confirmPassword: "Different10",
      }),
    ).not.toHaveProperty("confirmPassword");
    expect(
      clubRegisterSchema.parse({
        ...baseClub,
        confirmPassword: "Different10",
      }),
    ).not.toHaveProperty("confirmPassword");
  });
});

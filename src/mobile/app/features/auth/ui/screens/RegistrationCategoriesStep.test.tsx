import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { StudentRegistrationCategoriesStep } from "./StudentRegistrationCategoriesStep";
import { ClubRegistrationCategoriesStep } from "./ClubRegistrationCategoriesStep";

jest.mock("../../../../shared/components", () => ({
  CategorySelector: ({ label }: { label: string }) => {
    const { Text } = require("react-native");
    return <Text>{label}</Text>;
  },
  GradientButton: ({
    disabled,
    label,
    loading,
    onPress,
  }: {
    disabled?: boolean;
    label: string;
    loading?: boolean;
    onPress: () => void;
  }) =>
    (() => {
      const { Text } = require("react-native");
      return (
        <Text
          accessibilityRole="button"
          accessibilityState={{ busy: !!loading, disabled: !!disabled }}
          onPress={onPress}
        >
          {loading ? `${label} yükleniyor` : label}
        </Text>
      );
    })(),
}));

const baseProps = {
  coverImageUri: null,
  emailAvailabilityError: "",
  emailChecking: false,
  errors: {},
  goNext: jest.fn(),
  pickImage: jest.fn(),
  profileImageUri: null,
  selectedCategories: ["Teknoloji"],
  setField: jest.fn(),
  setSelectedCategories: jest.fn(),
  submit: jest.fn(),
  submitError: "Kayıt tamamlanamadı.",
  submitting: true,
  uploadProgress: "Profil fotoğrafı yükleniyor...",
  usernameAvailabilityError: "",
  usernameChecking: false,
  values: {
    bio: "",
    clubName: "Kulüp",
    department: "",
    description: "",
    email: "test@example.com",
    gradeYear: "",
    name: "Test User",
    password: "Password10",
    university: "UniVerse",
    username: "testuser",
  },
};

describe("registration category final step", () => {
  it("renders student submit progress, error, and loading state", () => {
    render(<StudentRegistrationCategoriesStep {...baseProps} />);

    expect(screen.getByText("Profil fotoğrafı yükleniyor...")).toBeOnTheScreen();
    expect(screen.getByText("Kayıt tamamlanamadı.")).toBeOnTheScreen();
    expect(
      screen.getByRole("button", { name: "Kayıt Ol yükleniyor" }).props.accessibilityState,
    ).toEqual({
      busy: true,
      disabled: true,
    });
  });

  it("blocks duplicate club submit while submitting", () => {
    const submit = jest.fn();
    render(<ClubRegistrationCategoriesStep {...baseProps} submit={submit} />);

    fireEvent.press(screen.getByRole("button", { name: "Kayıt Ol yükleniyor" }));

    expect(
      screen.getByRole("button", { name: "Kayıt Ol yükleniyor" }).props.accessibilityState,
    ).toEqual({
      busy: true,
      disabled: true,
    });
  });
});

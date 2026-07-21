import { fireEvent, render } from "@testing-library/react-native";
import { ProfileCategoryChips } from "./ProfileCategoryChips";

describe("ProfileCategoryChips", () => {
  it("expands every category and collapses back to the default count", () => {
    const screen = render(
      <ProfileCategoryChips
        accountType="student"
        categories={["Müzik", "Spor", "Teknoloji", "Sanat", "Gönüllülük"]}
      />,
    );

    expect(screen.getByText("Müzik")).toBeTruthy();
    expect(screen.getByText("Teknoloji")).toBeTruthy();
    expect(screen.queryByText("Sanat")).toBeNull();

    fireEvent.press(screen.getByText("+2"));

    expect(screen.getByText("Sanat")).toBeTruthy();
    expect(screen.getByText("Gönüllülük")).toBeTruthy();

    fireEvent.press(screen.getByText("Daha az"));

    expect(screen.queryByText("Sanat")).toBeNull();
    expect(screen.queryByText("Gönüllülük")).toBeNull();
    expect(screen.getByText("+2")).toBeTruthy();
  });
});

import { render } from "@testing-library/react-native";
import { DiscoveryUserGridCard } from "./DiscoveryUserGridCard";

describe("DiscoveryUserGridCard", () => {
  it.each([
    ["student" as const, "Öğrenci"],
    ["club" as const, "Kulüp"],
  ])("does not render the %s role badge", (accountType, roleLabel) => {
    const screen = render(
      <DiscoveryUserGridCard
        cardHeight={206}
        cardWidth={192}
        item={{
          accountType,
          id: `${accountType}-1`,
          image: "",
          isPrivate: false,
          name: accountType === "club" ? "Tasarım Kulübü" : "Ayşe Yılmaz",
          university: "Adıyaman Üniversitesi",
          username: accountType === "club" ? "tasarim" : "ayse",
        }}
        mediaHeight={84}
        onPress={() => undefined}
      />,
    );

    expect(screen.queryByText(roleLabel)).toBeNull();
  });
});

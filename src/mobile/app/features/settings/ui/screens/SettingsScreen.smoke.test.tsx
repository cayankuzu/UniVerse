import React from "react";
import { render, screen } from "@testing-library/react-native";
import { SettingsScreen } from "./SettingsScreen";

jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("../../../../app-shell/auth", () => ({
  useAuth: () => ({
    accountType: "student",
    authBootState: "signed_in_hydrated",
    blockedUsers: ["blocked-user"],
    deleteAccount: jest.fn(),
    isAuthBootstrapPending: false,
    logout: jest.fn(),
  }),
}));

jest.mock("../../../../shared/components", () => ({
  AppScrollView: ({ children }: { children: React.ReactNode }) => {
    const { View } = require("react-native");
    return <View>{children}</View>;
  },
  BackHeader: ({ title }: { title?: string }) => {
    const { Text } = require("react-native");
    return <Text>{title}</Text>;
  },
}));

jest.mock("./SettingsDeleteAccountModal", () => ({
  SettingsDeleteAccountModal: () => null,
}));

describe("SettingsScreen", () => {
  it("renders the settings sections and cards", () => {
    render(
      <SettingsScreen
        navigation={
          {
            canGoBack: () => true,
            goBack: jest.fn(),
            navigate: jest.fn(),
          } as never
        }
        route={{ key: "Settings", name: "Settings" } as never}
      />,
    );

    expect(screen.getByText("Ayarlar")).toBeOnTheScreen();
    expect(screen.getByText("Profili Düzenle")).toBeOnTheScreen();
    expect(screen.getByText("Gizlilik")).toBeOnTheScreen();
    expect(screen.getByText("Hesabı Sil")).toBeOnTheScreen();
  });
});

import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react-native";

import { UserListScreen } from "./UserListScreen";

const mockUseAuth = jest.fn();
const mockUseRelationshipList = jest.fn();

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

jest.mock("../../../../app-shell/auth", () => ({
  useAuth: () => mockUseAuth(),
}));

jest.mock("../../application/useRelationshipList", () => ({
  useRelationshipList: (...args: unknown[]) => mockUseRelationshipList(...args),
}));

jest.mock("../../application/useRelationshipUserRowState", () => ({
  useRelationshipUserRowState: () => ({
    followStatus: "none",
    handlePressIn: undefined,
    handleToggleFollow: undefined,
    isPrivate: false,
  }),
}));

jest.mock("../../../../shared/components", () => {
  const React = require("react");
  const { Text, View } = require("react-native");

  return {
    AppFlatList: ({
      data = [],
      emptyText,
      error,
      loading,
      ListFooterComponent,
      renderItem,
    }: {
      data?: unknown[];
      emptyText?: string;
      error?: string | null;
      loading?: boolean;
      ListFooterComponent?: React.ReactNode;
      renderItem?: (params: { index: number; item: unknown }) => React.ReactNode;
    }) => (
      <View>
        {loading && data.length === 0 ? <Text>loading</Text> : null}
        {!loading && data.length === 0 && error ? <Text>{error}</Text> : null}
        {!loading && data.length === 0 && !error && emptyText ? <Text>{emptyText}</Text> : null}
        {!loading && data.length > 0
          ? data.map((item, index) => renderItem?.({ item, index }) ?? null)
          : null}
        {ListFooterComponent ?? null}
      </View>
    ),
    Avatar: () => null,
    BackHeader: ({ title }: { title: string }) => <Text>{title}</Text>,
    GradientButton: ({ label }: { label: string }) => <Text>{label}</Text>,
    ListSearchBar: ({ placeholder, value }: { placeholder?: string; value?: string }) => (
      <Text>{value || placeholder || "search"}</Text>
    ),
  };
});

function createNavigation() {
  return {
    goBack: jest.fn(),
    navigate: jest.fn(),
  };
}

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
}

function renderScreen() {
  const queryClient = createQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <UserListScreen
        navigation={createNavigation() as any}
        route={
          {
            key: "followers",
            name: "UserList",
            params: { type: "followers", username: "club" },
          } as any
        }
      />
    </QueryClientProvider>,
  );
}

describe("UserListScreen", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      userData: { username: "viewer" },
    });
  });

  it("does not flash the empty state during the initial skeleton load", () => {
    mockUseRelationshipList.mockReturnValue({
      data: [],
      listKey: ["relationships"],
      projection: {
        loadMore: jest.fn(),
        loadingMore: false,
        onRefresh: jest.fn(),
        query: { error: null },
        refreshing: false,
        shouldShowInitialSkeleton: true,
      },
      viewerKey: "viewer",
      viewerUsername: "viewer",
    });

    renderScreen();

    expect(screen.queryByText("Henüz takipçi yok")).not.toBeOnTheScreen();
  });

  it("renders the shared empty copy after loading completes", () => {
    mockUseRelationshipList.mockReturnValue({
      data: [],
      listKey: ["relationships"],
      projection: {
        loadMore: jest.fn(),
        loadingMore: false,
        onRefresh: jest.fn(),
        query: { error: null },
        refreshing: false,
        shouldShowInitialSkeleton: false,
      },
      viewerKey: "viewer",
      viewerUsername: "viewer",
    });

    renderScreen();

    expect(screen.getByText("Henüz takipçi yok")).toBeOnTheScreen();
  });

  it("renders the shared error copy when the list fetch fails", () => {
    mockUseRelationshipList.mockReturnValue({
      data: [],
      listKey: ["relationships"],
      projection: {
        loadMore: jest.fn(),
        loadingMore: false,
        onRefresh: jest.fn(),
        query: { error: new Error("boom") },
        refreshing: false,
        shouldShowInitialSkeleton: false,
      },
      viewerKey: "viewer",
      viewerUsername: "viewer",
    });

    renderScreen();

    expect(screen.getByText("Liste yüklenemedi")).toBeOnTheScreen();
  });
});

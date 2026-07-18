import type { NavigatorScreenParams } from "@react-navigation/native";

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Register: undefined;
  StudentRegister: undefined;
  ClubRegister: undefined;
  VerifyEmail: { email?: string } | undefined;
  ForgotPassword: undefined;
  ResetPassword: undefined;
  AuthCallback: undefined;

  Home: undefined;
  Search: undefined;
  Profile: undefined;
  CreateEvent: undefined;
  Settings: undefined;
  Permissions: undefined;
  PrivacySettings: undefined;
  EditProfile: undefined;
  UserList: { type?: "followers" | "following"; username?: string } | undefined;
  ViewProfile: { username?: string } | undefined;
  AlbumView: { eventId?: string; photoId?: string } | undefined;
  EventDetail: { eventId?: string } | undefined;
  Notifications: undefined;
  ChangePassword: undefined;
  BlockedUsers: undefined;
};

export type AuthNavigatorParamList = Pick<
  RootStackParamList,
  | "Welcome"
  | "Login"
  | "Register"
  | "StudentRegister"
  | "ClubRegister"
  | "VerifyEmail"
  | "ForgotPassword"
>;

export type HomeStackParamList = Pick<RootStackParamList, "Home">;
export type SearchStackParamList = Pick<RootStackParamList, "Search">;
export type ProfileStackParamList = Pick<RootStackParamList, "Profile">;

export type MainTabsParamList = {
  HomeTab: NavigatorScreenParams<HomeStackParamList> | undefined;
  SearchTab: NavigatorScreenParams<SearchStackParamList> | undefined;
  ProfileTab: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

export type RootNavigatorParamList = {
  AuthNavigator: NavigatorScreenParams<AuthNavigatorParamList> | undefined;
  MainTabsNavigator: NavigatorScreenParams<MainTabsParamList> | undefined;
  ResetPassword: RootStackParamList["ResetPassword"];
  AuthCallback: RootStackParamList["AuthCallback"];
  CreateEvent: RootStackParamList["CreateEvent"];
  Settings: RootStackParamList["Settings"];
  Permissions: RootStackParamList["Permissions"];
  PrivacySettings: RootStackParamList["PrivacySettings"];
  EditProfile: RootStackParamList["EditProfile"];
  UserList: RootStackParamList["UserList"];
  ViewProfile: RootStackParamList["ViewProfile"];
  AlbumView: RootStackParamList["AlbumView"];
  EventDetail: RootStackParamList["EventDetail"];
  Notifications: RootStackParamList["Notifications"];
  ChangePassword: RootStackParamList["ChangePassword"];
  BlockedUsers: RootStackParamList["BlockedUsers"];
};

export type AuthRouteName = keyof AuthNavigatorParamList;
export type RootLeafRouteName = keyof RootStackParamList;

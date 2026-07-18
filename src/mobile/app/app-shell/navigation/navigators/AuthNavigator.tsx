import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import type { AuthNavigatorParamList } from "../types";

const getWelcomeScreen = () => require("../../../features/auth/public/screens").WelcomeScreen;
const getLoginScreen = () => require("../../../features/auth/public/screens").LoginScreen;
const getRegisterScreen = () => require("../../../features/auth/public/screens").RegisterScreen;
const getStudentRegisterScreen = () =>
  require("../../../features/auth/public/screens").StudentRegisterScreen;
const getClubRegisterScreen = () =>
  require("../../../features/auth/public/screens").ClubRegisterScreen;
const getVerifyEmailScreen = () =>
  require("../../../features/auth/public/screens").VerifyEmailScreen;
const getForgotPasswordScreen = () =>
  require("../../../features/auth/public/screens").ForgotPasswordScreen;

const AuthStack = createNativeStackNavigator<AuthNavigatorParamList>();

export function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        animation: "none",
        gestureEnabled: false,
        headerShown: false,
      }}
    >
      <AuthStack.Screen name="Welcome" getComponent={getWelcomeScreen} />
      <AuthStack.Screen name="Login" getComponent={getLoginScreen} />
      <AuthStack.Screen name="Register" getComponent={getRegisterScreen} />
      <AuthStack.Screen name="StudentRegister" getComponent={getStudentRegisterScreen} />
      <AuthStack.Screen name="ClubRegister" getComponent={getClubRegisterScreen} />
      <AuthStack.Screen name="VerifyEmail" getComponent={getVerifyEmailScreen} />
      <AuthStack.Screen name="ForgotPassword" getComponent={getForgotPasswordScreen} />
    </AuthStack.Navigator>
  );
}

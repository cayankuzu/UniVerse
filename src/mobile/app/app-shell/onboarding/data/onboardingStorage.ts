export {
  hasAnyPermissionGranted,
  parsePermissionSnapshot,
  persistPermissionPromptPreference,
  persistPermissionSnapshot,
  readPermissionPromptPreference,
  readPermissionSnapshot,
} from "../../../data/preferences/permissionStorage";
import { clearPermissionSnapshot } from "../../../data/preferences/permissionStorage";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ONBOARDING_PREFIX = "UNiETAS_onboarding_";

export function getOnboardingCompletionKey(accountType: string) {
  return `${ONBOARDING_PREFIX}${accountType}`;
}

export async function readOnboardingCompletion(accountType: string) {
  return AsyncStorage.getItem(getOnboardingCompletionKey(accountType));
}

export async function markOnboardingCompleted(accountType: string) {
  await AsyncStorage.setItem(getOnboardingCompletionKey(accountType), "completed");
}

export async function resetOnboardingStorage(accountType: string) {
  await AsyncStorage.removeItem(getOnboardingCompletionKey(accountType));
  await clearPermissionSnapshot();
}

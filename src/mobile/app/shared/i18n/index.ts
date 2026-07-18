import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import { trMessages, type MessageKey } from "./locales/tr";

type MessageParams = Record<string, string | number | null | undefined>;
const LOCALE_STORAGE_KEY = "app:locale:v1";

const localeMessages = {
  tr: trMessages,
} as const;

export type LocaleCode = keyof typeof localeMessages;

let currentLocale: LocaleCode = "tr";
const listeners = new Set<() => void>();

function isLocaleCode(value: string | null | undefined): value is LocaleCode {
  return value === "tr";
}

function getMessages(locale: LocaleCode = currentLocale) {
  return localeMessages[locale] ?? trMessages;
}

export function t(key: MessageKey, params?: MessageParams, locale: LocaleCode = currentLocale) {
  const template = getMessages(locale)[key] || key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (_match, token) => {
    const value = params[token];
    return value === null || value === undefined ? "" : String(value);
  });
}

function emitLocaleChange() {
  listeners.forEach((listener) => listener());
}

export function getLocale() {
  return currentLocale;
}

export function getAvailableLocales() {
  return Object.keys(localeMessages) as LocaleCode[];
}

export function setLocale(locale: LocaleCode) {
  if (locale === currentLocale) return currentLocale;
  currentLocale = locale;
  emitLocaleChange();
  return currentLocale;
}

export async function persistLocale(locale: LocaleCode) {
  setLocale(locale);
  if (getAvailableLocales().length === 1) {
    return currentLocale;
  }
  await AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale).catch(() => undefined);
  return currentLocale;
}

export async function hydrateLocale() {
  if (getAvailableLocales().length === 1) {
    return currentLocale;
  }
  const stored = await AsyncStorage.getItem(LOCALE_STORAGE_KEY).catch(() => null);
  if (isLocaleCode(stored)) {
    setLocale(stored);
  }
  return currentLocale;
}

export function subscribeLocale(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useLocale() {
  return useSyncExternalStore(subscribeLocale, getLocale, getLocale);
}

export function useTranslation() {
  const locale = useLocale();
  return {
    availableLocales: getAvailableLocales(),
    locale,
    setLocale,
    t: (key: MessageKey, params?: MessageParams) => t(key, params, locale),
  };
}

export { localeMessages, trMessages };
export type { MessageKey, MessageParams };

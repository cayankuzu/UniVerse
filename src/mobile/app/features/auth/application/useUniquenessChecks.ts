import { useCallback, useEffect, useRef, useState } from "react";
import { AuthAPI } from "../../../data/auth/auth.api";

const UNIQUENESS_RESULT_TTL_MS = 60_000;

type CheckOptions = {
  force?: boolean;
};

interface UseUniquenessChecksParams {
  validateUsername: (username: string) => boolean;
  validateEmail: (email: string) => boolean;
  setUsernameError: (value: string) => void;
  setEmailError: (value: string) => void;
  liveUsername?: {
    enabled: boolean;
    value: string;
    debounceMs?: number;
  };
  liveEmail?: {
    enabled: boolean;
    value: string;
    debounceMs?: number;
  };
}

export function useUniquenessChecks({
  validateUsername,
  validateEmail,
  setUsernameError,
  setEmailError,
  liveUsername,
  liveEmail,
}: UseUniquenessChecksParams) {
  const [usernameChecking, setUsernameChecking] = useState(false);
  const [emailChecking, setEmailChecking] = useState(false);
  const validateUsernameRef = useRef(validateUsername);
  const validateEmailRef = useRef(validateEmail);
  const usernameInFlightRef = useRef<string>("");
  const emailInFlightRef = useRef<string>("");
  const usernamePromiseRef = useRef<Promise<boolean> | null>(null);
  const emailPromiseRef = useRef<Promise<boolean> | null>(null);
  const mountedRef = useRef(true);
  const currentUsernameRef = useRef("");
  const currentEmailRef = useRef("");
  const lastUsernameResultRef = useRef<{
    value: string;
    available: boolean;
    checkedAt: number;
    reason?: string;
  } | null>(null);
  const lastEmailResultRef = useRef<{
    value: string;
    available: boolean;
    checkedAt: number;
    reason?: string;
  } | null>(null);
  const usernameAbortRef = useRef<AbortController | null>(null);
  const emailAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      usernameAbortRef.current?.abort();
      emailAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    validateUsernameRef.current = validateUsername;
  }, [validateUsername]);

  useEffect(() => {
    validateEmailRef.current = validateEmail;
  }, [validateEmail]);

  const checkUsernameAvailability = useCallback(
    async (usernameRaw: string, options: CheckOptions = {}) => {
      const rawUsername = usernameRaw.trim();
      if (!validateUsernameRef.current(rawUsername)) return false;
      const username = rawUsername.toLowerCase();
      currentUsernameRef.current = username;

      const last = lastUsernameResultRef.current;
      const canUseLast =
        last && last.value === username && Date.now() - last.checkedAt <= UNIQUENESS_RESULT_TTL_MS;
      if (canUseLast && !options.force) {
        if (!last.available) setUsernameError(last.reason || "Bu kullanıcı adı zaten alınmış");
        else setUsernameError("");
        return last.available;
      }
      if (usernameInFlightRef.current === username && usernamePromiseRef.current) {
        return usernamePromiseRef.current;
      }

      setUsernameChecking(true);
      usernameInFlightRef.current = username;
      usernameAbortRef.current?.abort();
      const controller = new AbortController();
      usernameAbortRef.current = controller;
      const promise = (async () => {
        try {
          const result = await AuthAPI.checkUsername(username, { signal: controller.signal });
          lastUsernameResultRef.current = {
            value: username,
            available: result.available,
            checkedAt: Date.now(),
            reason: result.reason,
          };
          if (currentUsernameRef.current !== username || !mountedRef.current) return false;
          if (!result.available) {
            setUsernameError(result.reason || "Bu kullanıcı adı zaten alınmış");
            return false;
          }
          setUsernameError("");
          return true;
        } catch {
          if (controller.signal.aborted) return false;
          lastUsernameResultRef.current = null;
          if (currentUsernameRef.current !== username || !mountedRef.current) return false;
          setUsernameError("Kullanıcı adı kontrol edilemedi. Tekrar dene.");
          return false;
        } finally {
          if (usernameInFlightRef.current === username) {
            usernameInFlightRef.current = "";
            usernamePromiseRef.current = null;
            if (usernameAbortRef.current === controller) usernameAbortRef.current = null;
            if (mountedRef.current) setUsernameChecking(false);
          }
        }
      })();
      usernamePromiseRef.current = promise;
      return promise;
    },
    [setUsernameError],
  );

  const checkEmailAvailability = useCallback(
    async (emailRaw: string, options: CheckOptions = {}) => {
      const email = emailRaw.trim().toLowerCase();
      if (!validateEmailRef.current(email)) return false;
      currentEmailRef.current = email;

      const last = lastEmailResultRef.current;
      const canUseLast =
        last && last.value === email && Date.now() - last.checkedAt <= UNIQUENESS_RESULT_TTL_MS;
      if (canUseLast && !options.force) {
        if (!last.available) setEmailError(last.reason || "Bu e-posta adresi zaten kullanılıyor");
        else setEmailError("");
        return last.available;
      }
      if (emailInFlightRef.current === email && emailPromiseRef.current) {
        return emailPromiseRef.current;
      }

      setEmailChecking(true);
      emailInFlightRef.current = email;
      emailAbortRef.current?.abort();
      const controller = new AbortController();
      emailAbortRef.current = controller;
      const promise = (async () => {
        try {
          const result = await AuthAPI.checkEmail(email, { signal: controller.signal });
          lastEmailResultRef.current = {
            value: email,
            available: result.available,
            checkedAt: Date.now(),
            reason: result.reason,
          };
          if (currentEmailRef.current !== email || !mountedRef.current) return false;
          if (!result.available) {
            setEmailError(result.reason || "Bu e-posta adresi zaten kullanılıyor");
            return false;
          }
          setEmailError("");
          return true;
        } catch {
          if (controller.signal.aborted) return false;
          lastEmailResultRef.current = null;
          if (currentEmailRef.current !== email || !mountedRef.current) return false;
          setEmailError("E-posta kontrol edilemedi. Tekrar dene.");
          return false;
        } finally {
          if (emailInFlightRef.current === email) {
            emailInFlightRef.current = "";
            emailPromiseRef.current = null;
            if (emailAbortRef.current === controller) emailAbortRef.current = null;
            if (mountedRef.current) setEmailChecking(false);
          }
        }
      })();
      emailPromiseRef.current = promise;
      return promise;
    },
    [setEmailError],
  );

  const liveUsernameEnabled = Boolean(liveUsername?.enabled);
  const liveUsernameValue = liveUsername?.value ?? "";
  const liveUsernameDebounceMs = liveUsername?.debounceMs ?? 350;

  const liveEmailEnabled = Boolean(liveEmail?.enabled);
  const liveEmailValue = liveEmail?.value ?? "";
  const liveEmailDebounceMs = liveEmail?.debounceMs ?? 350;

  useEffect(() => {
    if (!liveUsernameEnabled) return;

    const username = liveUsernameValue.trim();
    const normalizedUsername = username.toLowerCase();
    currentUsernameRef.current = normalizedUsername;
    if (usernameInFlightRef.current && usernameInFlightRef.current !== normalizedUsername) {
      usernameAbortRef.current?.abort();
      usernameInFlightRef.current = "";
      usernamePromiseRef.current = null;
      setUsernameChecking(false);
    }
    if (!username) {
      lastUsernameResultRef.current = null;
      setUsernameError("");
      return;
    }
    if (usernameInFlightRef.current === normalizedUsername) return;
    const last = lastUsernameResultRef.current;
    if (
      last?.value === normalizedUsername &&
      Date.now() - last.checkedAt <= UNIQUENESS_RESULT_TTL_MS
    )
      return;

    const timer = setTimeout(() => {
      void checkUsernameAvailability(username);
    }, liveUsernameDebounceMs);

    return () => clearTimeout(timer);
  }, [
    checkUsernameAvailability,
    liveUsernameDebounceMs,
    liveUsernameEnabled,
    liveUsernameValue,
    setUsernameError,
  ]);

  useEffect(() => {
    if (!liveEmailEnabled) return;

    const email = liveEmailValue.trim();
    const normalizedEmail = email.toLowerCase();
    currentEmailRef.current = normalizedEmail;
    if (emailInFlightRef.current && emailInFlightRef.current !== normalizedEmail) {
      emailAbortRef.current?.abort();
      emailInFlightRef.current = "";
      emailPromiseRef.current = null;
      setEmailChecking(false);
    }
    if (!email) {
      lastEmailResultRef.current = null;
      setEmailError("");
      return;
    }
    if (emailInFlightRef.current === normalizedEmail) return;
    const last = lastEmailResultRef.current;
    if (last?.value === normalizedEmail && Date.now() - last.checkedAt <= UNIQUENESS_RESULT_TTL_MS)
      return;

    const timer = setTimeout(() => {
      void checkEmailAvailability(email);
    }, liveEmailDebounceMs);

    return () => clearTimeout(timer);
  }, [
    checkEmailAvailability,
    liveEmailDebounceMs,
    liveEmailEnabled,
    liveEmailValue,
    setEmailError,
  ]);

  return {
    usernameChecking,
    emailChecking,
    checkUsernameAvailability,
    checkEmailAvailability,
  };
}

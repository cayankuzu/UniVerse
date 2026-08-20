import { startTransition, useCallback, useEffect, useRef, useState } from "react";
import type { AuthUserData } from "../../../data/contracts/entities";
import { getViewerKey } from "../../../data/contracts/viewerKey";
import { scheduleAfterInteractions } from "../../../shared/utils/scheduleAfterInteractions";
import { updateViewerPrivacySetting, updateViewerProfileSetting } from "../data";
import { usePrivacySettingsCacheActions } from "./usePrivacySettingsCacheActions";
import { showErrorAlert } from "../../../shared/utils/alerts";

interface UsePrivacySettingsStateParams {
  accountType: "club" | "student" | null | undefined;
  goBack: () => void;
  isPrivateAccount: boolean;
  setIsPrivateAccount: (value: boolean) => void;
  updateUserData: (data: Partial<AuthUserData>) => void;
  userData: AuthUserData;
}

export function usePrivacySettingsState(params: UsePrivacySettingsStateParams) {
  const { accountType, goBack, setIsPrivateAccount, updateUserData } = params;
  const viewerKey = getViewerKey(params.userData);
  const { applyHideEmailCacheUpdate, applyPrivacyCacheUpdate, refreshPrivacyCaches } =
    usePrivacySettingsCacheActions({
      username: params.userData.username,
      viewerKey,
    });
  const resolvedPrivacy = params.accountType === "club" ? false : Boolean(params.isPrivateAccount);
  const [hideEmail, setHideEmail] = useState(Boolean(params.userData.hideEmail));
  const [isPrivateAccount, setDisplayPrivacy] = useState(resolvedPrivacy);
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [savingHideEmail, setSavingHideEmail] = useState(false);
  const confirmedPrivacyRef = useRef(resolvedPrivacy);
  const desiredPrivacyRef = useRef(resolvedPrivacy);
  const privacyFlushPromiseRef = useRef<Promise<void> | null>(null);
  const privacyRefreshTaskRef = useRef<{ cancel: () => void } | null>(null);

  useEffect(() => {
    setHideEmail(Boolean(params.userData.hideEmail));
  }, [params.userData.hideEmail]);

  useEffect(() => {
    if (savingPrivacy) return;
    confirmedPrivacyRef.current = resolvedPrivacy;
    desiredPrivacyRef.current = resolvedPrivacy;
    setDisplayPrivacy(resolvedPrivacy);
  }, [resolvedPrivacy, savingPrivacy]);

  useEffect(
    () => () => {
      privacyRefreshTaskRef.current?.cancel();
      privacyFlushPromiseRef.current = null;
    },
    [],
  );

  const applyOptimisticPrivacyState = useCallback(
    (nextValue: boolean) => {
      desiredPrivacyRef.current = nextValue;
      setDisplayPrivacy(nextValue);
      startTransition(() => {
        setIsPrivateAccount(nextValue);
        applyPrivacyCacheUpdate(nextValue);
      });
    },
    [applyPrivacyCacheUpdate, setIsPrivateAccount],
  );

  const scheduleDeferredPrivacyRefresh = useCallback(() => {
    privacyRefreshTaskRef.current?.cancel();
    privacyRefreshTaskRef.current = scheduleAfterInteractions(() => {
      refreshPrivacyCaches();
      privacyRefreshTaskRef.current = null;
    }, 120);
  }, [refreshPrivacyCaches]);

  const flushPrivacyPreference = useCallback(async () => {
    if (privacyFlushPromiseRef.current) {
      return privacyFlushPromiseRef.current;
    }

    const run = (async () => {
      setSavingPrivacy(true);
      try {
        while (desiredPrivacyRef.current !== confirmedPrivacyRef.current) {
          const nextValue = desiredPrivacyRef.current;
          await updateViewerPrivacySetting(nextValue);
          confirmedPrivacyRef.current = nextValue;
        }
        scheduleDeferredPrivacyRefresh();
      } catch (error: unknown) {
        const rollbackValue = confirmedPrivacyRef.current;
        desiredPrivacyRef.current = rollbackValue;
        setDisplayPrivacy(rollbackValue);
        startTransition(() => {
          setIsPrivateAccount(rollbackValue);
          applyPrivacyCacheUpdate(rollbackValue);
        });
        scheduleDeferredPrivacyRefresh();
        showErrorAlert(
          String((error as { message?: string })?.message || "Gizlilik ayarı güncellenemedi."),
        );
      } finally {
        setSavingPrivacy(false);
        privacyFlushPromiseRef.current = null;
        if (desiredPrivacyRef.current !== confirmedPrivacyRef.current) {
          void flushPrivacyPreference();
        }
      }
    })();

    privacyFlushPromiseRef.current = run;
    return run;
  }, [applyPrivacyCacheUpdate, scheduleDeferredPrivacyRefresh, setIsPrivateAccount]);

  const handleTogglePrivacy = useCallback(() => {
    if (accountType === "club") return;
    applyOptimisticPrivacyState(!desiredPrivacyRef.current);
    void flushPrivacyPreference();
  }, [accountType, applyOptimisticPrivacyState, flushPrivacyPreference]);

  const handleHideEmailToggle = useCallback(async () => {
    if (savingHideEmail) return;
    const nextValue = !hideEmail;
    const previous = hideEmail;
    setSavingHideEmail(true);
    setHideEmail(nextValue);
    updateUserData({ hideEmail: nextValue });
    applyHideEmailCacheUpdate(nextValue);
    try {
      await updateViewerProfileSetting("hideEmail", nextValue);
    } catch {
      setHideEmail(previous);
      updateUserData({ hideEmail: previous });
      applyHideEmailCacheUpdate(previous);
      showErrorAlert("Ayar kaydedilemedi.", "Uyarı");
    } finally {
      setSavingHideEmail(false);
    }
  }, [applyHideEmailCacheUpdate, hideEmail, savingHideEmail, updateUserData]);

  return {
    accountType,
    handleBack: goBack,
    handleHideEmailToggle,
    handleTogglePrivacy,
    hideEmail,
    isPrivateAccount,
    savingHideEmail,
    savingPrivacy,
  };
}

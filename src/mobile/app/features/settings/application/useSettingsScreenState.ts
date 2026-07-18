import { useCallback, useMemo, useState } from "react";
import { showConfirmAlert } from "../../../shared/utils/alerts";
import { buildSettingsSections } from "../ui/screens/settingsScreen.shared";

interface UseSettingsScreenStateParams {
  accountType: "club" | "student" | null | undefined;
  blockedUsersCount: number;
  deleteAccount: () => Promise<unknown>;
  goBack: () => void;
  logout: () => Promise<unknown>;
  resetToWelcome: () => void;
}

export function useSettingsScreenState(params: UseSettingsScreenStateParams) {
  const { deleteAccount, logout, resetToWelcome } = params;
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [operationError, setOperationError] = useState("");

  const sections = useMemo(
    () =>
      buildSettingsSections({
        accountType: params.accountType,
        blockedUsersCount: params.blockedUsersCount,
        deletingAccount,
        loggingOut,
      }),
    [deletingAccount, params.accountType, params.blockedUsersCount, loggingOut],
  );

  const performLogout = useCallback(async () => {
    if (loggingOut) return;
    setOperationError("");
    setLoggingOut(true);
    try {
      await logout();
      resetToWelcome();
    } catch (error: unknown) {
      setOperationError(
        String((error as { message?: string } | null)?.message || "Çıkış yapılamadı. Tekrar dene."),
      );
    } finally {
      setLoggingOut(false);
    }
  }, [loggingOut, logout, resetToWelcome]);

  const handleLogout = useCallback(() => {
    if (loggingOut) return;
    showConfirmAlert({
      confirmLabel: "Çıkış Yap",
      destructive: true,
      message: "Hesabından çıkış yapmak istediğine emin misin?",
      onConfirm: () => {
        void performLogout();
      },
      title: "Çıkış Yap",
    });
  }, [loggingOut, performLogout]);

  const handleDeleteAccount = useCallback(async () => {
    if (deletingAccount) return;
    setOperationError("");
    setDeletingAccount(true);
    try {
      await deleteAccount();
      resetToWelcome();
    } catch (error: unknown) {
      setOperationError(
        String((error as { message?: string } | null)?.message || "Hesap silinemedi. Tekrar dene."),
      );
    } finally {
      setDeletingAccount(false);
    }
  }, [deleteAccount, deletingAccount, resetToWelcome]);

  const hideDeleteConfirm = useCallback(() => {
    if (deletingAccount) return;
    setShowDeleteConfirm(false);
  }, [deletingAccount]);

  const showDeleteConfirmModal = useCallback(() => {
    setOperationError("");
    setShowDeleteConfirm(true);
  }, []);

  return {
    accountType: params.accountType,
    deletingAccount,
    handleBack: params.goBack,
    handleDeleteAccount,
    handleLogout,
    hideDeleteConfirm,
    loggingOut,
    operationError,
    sections,
    showDeleteConfirm,
    showDeleteConfirmModal,
  };
}

import { useCallback } from "react";
import { showConfirmAlert, showErrorAlert, showInfoAlert } from "../../../shared/utils/alerts";
import type { ProfileTileItem, UserProfile } from "../application/profileUiModels";
import { reportProfileUiError } from "../application/profileUiLogging";

type AccessState = {
  allowed: boolean;
  warningMessage: string | null;
};

type UseViewProfileScreenActionsParams = {
  albums: Array<{ id?: string }>;
  canViewContent: boolean;
  canViewFollowers: boolean;
  canViewFollowing: boolean;
  completeReport: () => void;
  contentWarningMessage: string | null;
  events: Array<{ id?: string }>;
  failReport: () => void;
  followersAccess: AccessState;
  followAction: {
    confirmation: {
      cancelLabel?: string;
      confirmLabel: string;
      destructive?: boolean;
      message: string;
      title: string;
    } | null;
    run: () => void;
  };
  followingAccess: AccessState;
  isTargetBlocked: boolean;
  loadMore: () => Promise<unknown> | unknown;
  loadingMore: boolean;
  navigation: {
    navigate: (
      screen: "UserList",
      params: { type: "followers" | "following"; username: string },
    ) => void;
  };
  openProfile: (username: string) => void;
  profile: Pick<UserProfile, "username"> | null | undefined;
  runBlockToggle: (currentlyBlocked: boolean) => Promise<unknown>;
  runReport: (reason?: string) => Promise<unknown>;
  setViewerIndex: (value: number) => void;
  setViewerTargetId: (value: string | null) => void;
  setViewerType: (value: "events" | "albums" | null) => void;
  setWarningMessage: (message: string | null) => void;
};

function resolveLockedContentWarning(message: string | null) {
  return message || "Bu hesabın içerikleri görüntülenemiyor.";
}

export function useViewProfileScreenActions(params: UseViewProfileScreenActionsParams) {
  const navigateFollowers = useCallback(
    (targetUsername: string) => {
      params.navigation.navigate("UserList", {
        type: "followers",
        username: targetUsername,
      });
    },
    [params.navigation],
  );
  const navigateFollowing = useCallback(
    (targetUsername: string) => {
      params.navigation.navigate("UserList", {
        type: "following",
        username: targetUsername,
      });
    },
    [params.navigation],
  );
  const openFollowersList = useCallback(() => {
    if (!params.profile?.username) return;
    if (!params.canViewFollowers || !params.followersAccess.allowed) {
      params.setWarningMessage(
        params.followersAccess.warningMessage || "Takipçi listesi bu kullanıcı için sınırlı.",
      );
      return;
    }
    navigateFollowers(params.profile.username);
  }, [navigateFollowers, params]);
  const openFollowingList = useCallback(() => {
    if (!params.profile?.username) return;
    if (!params.canViewFollowing || !params.followingAccess.allowed) {
      params.setWarningMessage(
        params.followingAccess.warningMessage || "Takip listesi bu kullanıcı için sınırlı.",
      );
      return;
    }
    navigateFollowing(params.profile.username);
  }, [navigateFollowing, params]);
  const handleFollowPress = useCallback(() => {
    if (params.followAction.confirmation) {
      showConfirmAlert({
        ...params.followAction.confirmation,
        onConfirm: () => params.followAction.run(),
      });
      return;
    }
    params.followAction.run();
  }, [params.followAction]);
  const handleProfileReport = useCallback(
    async (reason: string) => {
      try {
        await params.runReport(reason);
        params.completeReport();
      } catch (error) {
        reportProfileUiError(error, "report-submit");
        params.failReport();
        showErrorAlert("Şikayet gönderilemedi.");
      }
    },
    [params],
  );
  const confirmBlockToggle = useCallback(() => {
    const blocked = params.isTargetBlocked;
    showConfirmAlert({
      confirmLabel: blocked ? "Engeli Kaldır" : "Engelle",
      destructive: true,
      message: blocked
        ? "Bu kullanıcının engelini kaldırmak istediğinize emin misiniz?"
        : "Bu kullanıcıyı engellemek istediğinize emin misiniz?",
      onConfirm: () =>
        void params.runBlockToggle(blocked).then(() => {
          showInfoAlert(
            "Bilgi",
            blocked ? "Kullanıcı engeli kaldırıldı." : "Kullanıcı engellendi.",
          );
        }),
      title: blocked ? "Engeli Kaldır" : "Kullanıcıyı Engelle",
    });
  }, [params]);
  const openAlbumAt = useCallback(
    (item: ProfileTileItem) => {
      if (!params.canViewContent) {
        params.setWarningMessage(resolveLockedContentWarning(params.contentWarningMessage));
        return;
      }
      const targetId = String(item?.id || "").trim();
      const targetIndex = params.albums.findIndex((album) => album.id === targetId);
      if (!targetId || targetIndex < 0) return;
      params.setViewerTargetId(targetId);
      params.setViewerType("albums");
      params.setViewerIndex(targetIndex);
    },
    [params],
  );
  const openEventAt = useCallback(
    (item: ProfileTileItem) => {
      if (!params.canViewContent) {
        params.setWarningMessage(resolveLockedContentWarning(params.contentWarningMessage));
        return;
      }
      const targetId = String(item?.id || "").trim();
      const targetIndex = params.events.findIndex((event) => event.id === targetId);
      if (!targetId || targetIndex < 0) return;
      params.setViewerTargetId(targetId);
      params.setViewerType("events");
      params.setViewerIndex(targetIndex);
    },
    [params],
  );
  const openContentProfile = useCallback(
    (targetUsername: string) => {
      params.openProfile(targetUsername);
    },
    [params],
  );
  const handleLoadMore = useCallback(() => {
    if (params.loadingMore) return;
    void params.loadMore();
  }, [params]);

  return {
    confirmBlockToggle,
    handleFollowPress,
    handleLoadMore,
    handleProfileReport,
    navigateFollowers,
    navigateFollowing,
    openAlbumAt,
    openContentProfile,
    openEventAt,
    openFollowersList,
    openFollowingList,
  };
}

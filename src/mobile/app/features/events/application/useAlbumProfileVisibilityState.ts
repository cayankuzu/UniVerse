import { useCallback, useState } from "react";
import { resolveAlbumProfileVisibilityState } from "../../../data/policies/visibility.shared";

export function useAlbumProfileVisibilityState() {
  const [visibility, setVisibility] = useState({
    showOnClubProfile: true,
    showOnOwnProfile: true,
  });

  const resetProfileVisibility = useCallback(() => {
    setVisibility({
      showOnClubProfile: true,
      showOnOwnProfile: true,
    });
  }, []);

  const updateShowOnOwnProfile = useCallback((nextValue: boolean) => {
    setVisibility((current) =>
      resolveAlbumProfileVisibilityState(current, {
        target: "own",
        value: nextValue,
      }),
    );
  }, []);

  const updateShowOnClubProfile = useCallback((nextValue: boolean) => {
    setVisibility((current) =>
      resolveAlbumProfileVisibilityState(current, {
        target: "club",
        value: nextValue,
      }),
    );
  }, []);

  return {
    resetProfileVisibility,
    showOnClubProfile: visibility.showOnClubProfile,
    showOnOwnProfile: visibility.showOnOwnProfile,
    updateShowOnClubProfile,
    updateShowOnOwnProfile,
  };
}

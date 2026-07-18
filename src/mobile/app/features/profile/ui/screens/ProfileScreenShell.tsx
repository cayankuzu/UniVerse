import { memo, type ReactNode } from "react";
import { MoreVertical } from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppIconButton, AsyncState, BackHeader } from "../../../../shared/components";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";
import { PROFILE_COLORS } from "../../domain/viewProfile.helpers";

type Props = {
  children: ReactNode;
  empty: boolean;
  emptyText: string;
  error: string | null;
  loading: boolean;
  onBack: () => void;
  onOpenMenu: () => void;
  showMenuButton: boolean;
  title: string;
};

export const ProfileScreenShell = memo(function ProfileScreenShell({
  children,
  empty,
  emptyText,
  error,
  loading,
  onBack,
  onOpenMenu,
  showMenuButton,
  title,
}: Props) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: PROFILE_COLORS.bg }} edges={["bottom"]}>
      <BackHeader
        title={title}
        onBack={onBack}
        right={
          showMenuButton ? (
            <AppIconButton
              accessibilityLabel={t("viewProfile.menu.actions")}
              icon={({ color, size }) => <MoreVertical size={size} color={color} />}
              onPress={onOpenMenu}
              outlineColor={tokens.colors.border}
              size={36}
              style={{ borderRadius: 10 }}
              surfaceColor={tokens.colors.surfaceVariant}
            />
          ) : undefined
        }
      />
      <AsyncState loading={loading} error={error} empty={empty} emptyText={emptyText}>
        {children}
      </AsyncState>
    </SafeAreaView>
  );
});

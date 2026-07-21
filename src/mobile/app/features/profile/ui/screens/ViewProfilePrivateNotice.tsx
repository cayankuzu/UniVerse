import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

interface ViewProfilePrivateNoticeProps {
  text?: string;
  visible: boolean;
}

export function ViewProfilePrivateNotice({ text, visible }: ViewProfilePrivateNoticeProps) {
  if (!visible) return null;

  return (
    <View
      style={{
        marginTop: tokens.spacing.compact,
        marginHorizontal: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: tokens.colors.orangeBorder,
        backgroundColor: tokens.colors.warningSurface,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.compact,
      }}
    >
      <Text
        style={{
          color: tokens.colors.orangeDeep,
          fontSize: tokens.typography.label,
          fontWeight: tokens.fontWeight.extrabold,
        }}
      >
        {t("viewProfile.private.notice.title")}
      </Text>
      <Text
        style={{
          marginTop: tokens.spacing.xxs,
          color: tokens.colors.orangeDeep,
          fontSize: tokens.typography.caption,
          lineHeight: tokens.lineHeight.label,
        }}
      >
        {text || t("viewProfile.private.notice.subtitle")}
      </Text>
    </View>
  );
}

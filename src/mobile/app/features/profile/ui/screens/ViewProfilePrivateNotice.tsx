import { Text, View } from "react-native";
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
        marginTop: 10,
        marginHorizontal: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: "#fed7aa",
        backgroundColor: tokens.colors.warningSurface,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: "#9a3412", fontSize: 13, fontWeight: tokens.fontWeight.extrabold }}>
        {t("viewProfile.private.notice.title")}
      </Text>
      <Text
        style={{
          marginTop: 4,
          color: "#9a3412",
          fontSize: tokens.typography.caption,
          lineHeight: 18,
        }}
      >
        {text || t("viewProfile.private.notice.subtitle")}
      </Text>
    </View>
  );
}

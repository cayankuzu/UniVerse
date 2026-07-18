import React from "react";
import { Text } from "react-native";
import { tokens } from "../../../../shared/theme";

type Props = {
  notice: { kind: "error" | "info"; text: string } | null;
};

export const NotificationsNotice = React.memo(function NotificationsNotice({ notice }: Props) {
  if (!notice) return null;

  return (
    <Text
      style={{
        marginHorizontal: 16,
        marginTop: 8,
        color: notice.kind === "error" ? "#b91c1c" : tokens.colors.primary,
        fontSize: 12,
        fontWeight: "700",
        textAlign: "center",
      }}
    >
      {notice.text}
    </Text>
  );
});

import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";

import { tokens } from "../../../../shared/theme";

type Props = {
  notice: { kind: "error" | "info"; text: string } | null;
};

export const NotificationsNotice = React.memo(function NotificationsNotice({ notice }: Props) {
  if (!notice) return null;

  return (
    <Text
      style={{
        marginHorizontal: tokens.spacing.md,
        marginTop: tokens.spacing.xs,
        color: notice.kind === "error" ? tokens.colors.dangerStrong : tokens.colors.primary,
        fontSize: tokens.typography.caption,
        fontWeight: "700",
        textAlign: "center",
      }}
    >
      {notice.text}
    </Text>
  );
});

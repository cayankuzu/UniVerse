import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { Check, X } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppModalHost,
  AppScrollView as ScrollView,
  GradientButton,
} from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";
import { LEGAL_DOCUMENTS, type LegalDocumentId } from "../../data/legalDocuments";

type Props = {
  accepted: boolean;
  onToggleAccepted: () => void;
};

export function AuthLegalConsent({ accepted, onToggleAccepted }: Props) {
  const insets = useSafeAreaInsets();
  const [openDocumentId, setOpenDocumentId] = React.useState<LegalDocumentId | null>(null);
  const activeDocument = openDocumentId ? LEGAL_DOCUMENTS[openDocumentId] : null;

  return (
    <>
      <View
        style={{
          borderRadius: tokens.radius.lg,
          borderWidth: 1,
          borderColor: accepted ? tokens.colors.primaryBorder : tokens.colors.primarySoft,
          backgroundColor: accepted ? tokens.colors.primarySofter : tokens.colors.surfaceTint,
          gap: tokens.spacing.sm,
          padding: tokens.spacing.md,
        }}
      >
        <View style={{ gap: tokens.spacing.xsMinus }}>
          <Text
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.body,
              fontWeight: "700",
            }}
          >
            {t("auth.legal.reviewTitle")}
          </Text>
          <Text
            style={{
              color: tokens.colors.dark600,
              fontSize: tokens.typography.label,
              lineHeight: tokens.lineHeight.body,
            }}
          >
            <Text
              onPress={() => setOpenDocumentId("terms")}
              style={{ color: tokens.colors.primary, fontWeight: "700" }}
            >
              {t("auth.legal.terms")}
            </Text>
            <Text>{t("auth.legal.separator")}</Text>
            <Text
              onPress={() => setOpenDocumentId("kvkk")}
              style={{ color: tokens.colors.primary, fontWeight: "700" }}
            >
              {t("auth.legal.kvkk")}
            </Text>
            <Text>{t("auth.legal.and")}</Text>
            <Text
              onPress={() => setOpenDocumentId("privacy")}
              style={{ color: tokens.colors.primary, fontWeight: "700" }}
            >
              {t("auth.legal.privacy")}
            </Text>
            <Text>{t("auth.legal.clickHint")}</Text>
          </Text>
        </View>

        <Pressable
          accessibilityLabel={t("auth.legal.checkboxLabel")}
          accessibilityRole="checkbox"
          accessibilityState={{ checked: accepted }}
          onPress={onToggleAccepted}
          style={{
            alignItems: "flex-start",
            flexDirection: "row",
            gap: tokens.spacing.sm,
            minHeight: tokens.minHeight.row,
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: accepted ? tokens.colors.primary : tokens.colors.surface,
              borderColor: accepted ? tokens.colors.primary : tokens.colors.mutedFg,
              borderRadius: tokens.radius.sm,
              borderWidth: 1.5,
              height: 20,
              justifyContent: "center",
              marginTop: tokens.spacing.micro,
              width: 20,
            }}
          >
            {accepted ? <Check size={15} color={tokens.colors.surface} strokeWidth={2.5} /> : null}
          </View>

          <View style={{ flex: 1, gap: tokens.spacing.xxs }}>
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: tokens.typography.label,
                fontWeight: "700",
                lineHeight: tokens.lineHeight.label,
              }}
            >
              {t("auth.legal.accepted")}
            </Text>
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                lineHeight: tokens.lineHeight.label,
              }}
            >
              {t("auth.legal.acceptedHint")}
            </Text>
          </View>
        </Pressable>
      </View>

      <AppModalHost
        accessibilityAnnouncement={activeDocument?.title}
        visible={!!activeDocument}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setOpenDocumentId(null)}
      >
        <View
          accessibilityViewIsModal
          style={{
            backgroundColor: tokens.colors.overlayLight,
            flex: 1,
            justifyContent: "flex-end",
            paddingBottom: Math.max(insets.bottom + 16, 16),
            paddingHorizontal: tokens.spacing.md,
            paddingTop: Math.max(insets.top + 16, 24),
          }}
        >
          <Pressable
            onPress={() => setOpenDocumentId(null)}
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              left: 0,
            }}
          />
          <View
            style={{
              backgroundColor: tokens.colors.surface,
              borderRadius: tokens.radius["2xl"],
              maxHeight: "82%",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                alignItems: "center",
                borderBottomColor: withAlpha(tokens.colors.textSubtle, 0.24),
                borderBottomWidth: 1,
                flexDirection: "row",
                gap: tokens.spacing.sm,
                justifyContent: "space-between",
                paddingHorizontal: tokens.spacing.mdPlus,
                paddingVertical: tokens.spacing.md,
              }}
            >
              <View style={{ flex: 1, gap: tokens.spacing.xxs }}>
                <Text
                  style={{
                    color: tokens.colors.foreground,
                    fontSize: tokens.typography.cardTitle,
                    fontWeight: "800",
                  }}
                >
                  {activeDocument?.title}
                </Text>
                <Text
                  style={{
                    color: tokens.colors.muted,
                    fontSize: tokens.typography.label,
                    lineHeight: tokens.lineHeight.bodyCompact,
                  }}
                >
                  {activeDocument?.summary}
                </Text>
              </View>

              <Pressable
                accessibilityLabel={t("auth.legal.closeA11y")}
                accessibilityRole="button"
                onPress={() => setOpenDocumentId(null)}
                style={{
                  alignItems: "center",
                  backgroundColor: tokens.colors.surfaceVariant,
                  borderRadius: tokens.radius.pill,
                  height: tokens.minHeight.header,
                  justifyContent: "center",
                  width: tokens.minHeight.header,
                }}
              >
                <X size={tokens.iconSize.lg} color={tokens.colors.dark700} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                gap: tokens.spacing.md,
                paddingBottom: tokens.spacing.mdPlus,
                paddingHorizontal: tokens.spacing.mdPlus,
                paddingTop: tokens.spacing.mdPlus,
              }}
              showsVerticalScrollIndicator={false}
            >
              {activeDocument?.sections.map((section) => (
                <View key={section.heading} style={{ gap: tokens.spacing.xs }}>
                  <Text
                    style={{
                      color: tokens.colors.foreground,
                      fontSize: tokens.typography.control,
                      fontWeight: "800",
                    }}
                  >
                    {section.heading}
                  </Text>
                  {section.body.map((paragraph) => (
                    <Text
                      key={`${section.heading}:${paragraph.slice(0, 24)}`}
                      style={{
                        color: tokens.colors.dark600,
                        fontSize: tokens.typography.label,
                        lineHeight: tokens.lineHeight.body,
                      }}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View
              style={{
                borderTopColor: withAlpha(tokens.colors.textSubtle, 0.24),
                borderTopWidth: 1,
                paddingHorizontal: tokens.spacing.mdPlus,
                paddingVertical: tokens.spacing.md,
              }}
            >
              <GradientButton
                label={t("auth.legal.understood")}
                onPress={() => setOpenDocumentId(null)}
                size="lg"
              />
            </View>
          </View>
        </View>
      </AppModalHost>
    </>
  );
}

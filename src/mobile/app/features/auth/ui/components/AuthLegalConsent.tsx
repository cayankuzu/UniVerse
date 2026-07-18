import React from "react";
import { Check, X } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  AppModalHost,
  AppScrollView as ScrollView,
  GradientButton,
} from "../../../../shared/components";
import { tokens } from "../../../../shared/theme";
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
          borderRadius: 16,
          borderWidth: 1,
          borderColor: accepted ? tokens.colors.primaryBorder : tokens.colors.primarySoft,
          backgroundColor: accepted ? tokens.colors.primarySofter : tokens.colors.surfaceTint,
          gap: 12,
          padding: 16,
        }}
      >
        <View style={{ gap: 6 }}>
          <Text style={{ color: tokens.colors.foreground, fontSize: 14, fontWeight: "700" }}>
            {t("auth.legal.reviewTitle")}
          </Text>
          <Text style={{ color: tokens.colors.dark600, fontSize: 13, lineHeight: 20 }}>
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
            gap: 12,
            minHeight: tokens.minHeight.touchTarget,
          }}
        >
          <View
            style={{
              alignItems: "center",
              backgroundColor: accepted ? tokens.colors.primary : tokens.colors.surface,
              borderColor: accepted ? tokens.colors.primary : tokens.colors.mutedFg,
              borderRadius: 8,
              borderWidth: 1.5,
              height: 24,
              justifyContent: "center",
              marginTop: 2,
              width: 24,
            }}
          >
            {accepted ? <Check size={15} color={tokens.colors.surface} strokeWidth={2.5} /> : null}
          </View>

          <View style={{ flex: 1, gap: 4 }}>
            <Text
              style={{
                color: tokens.colors.foreground,
                fontSize: 13,
                fontWeight: "700",
                lineHeight: 18,
              }}
            >
              {t("auth.legal.accepted")}
            </Text>
            <Text style={{ color: tokens.colors.muted, fontSize: 12, lineHeight: 18 }}>
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
            paddingHorizontal: 16,
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
              borderRadius: 24,
              maxHeight: "82%",
              overflow: "hidden",
            }}
          >
            <View
              style={{
                alignItems: "center",
                borderBottomColor: "rgba(148,163,184,0.24)",
                borderBottomWidth: 1,
                flexDirection: "row",
                gap: 12,
                justifyContent: "space-between",
                paddingHorizontal: 18,
                paddingVertical: 16,
              }}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: tokens.colors.foreground, fontSize: 18, fontWeight: "800" }}>
                  {activeDocument?.title}
                </Text>
                <Text style={{ color: tokens.colors.muted, fontSize: 13, lineHeight: 19 }}>
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
                  borderRadius: 999,
                  height: tokens.minHeight.touchTarget,
                  justifyContent: "center",
                  width: tokens.minHeight.touchTarget,
                }}
              >
                <X size={18} color={tokens.colors.dark700} />
              </Pressable>
            </View>

            <ScrollView
              contentContainerStyle={{
                gap: 16,
                paddingBottom: 18,
                paddingHorizontal: 18,
                paddingTop: 18,
              }}
              showsVerticalScrollIndicator={false}
            >
              {activeDocument?.sections.map((section) => (
                <View key={section.heading} style={{ gap: 8 }}>
                  <Text
                    style={{ color: tokens.colors.foreground, fontSize: 15, fontWeight: "800" }}
                  >
                    {section.heading}
                  </Text>
                  {section.body.map((paragraph) => (
                    <Text
                      key={`${section.heading}:${paragraph.slice(0, 24)}`}
                      style={{ color: tokens.colors.dark600, fontSize: 13, lineHeight: 20 }}
                    >
                      {paragraph}
                    </Text>
                  ))}
                </View>
              ))}
            </ScrollView>

            <View
              style={{
                borderTopColor: "rgba(148,163,184,0.24)",
                borderTopWidth: 1,
                paddingHorizontal: 18,
                paddingVertical: 16,
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

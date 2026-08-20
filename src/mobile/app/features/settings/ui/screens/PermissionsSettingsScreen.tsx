import React from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { ActivityIndicator, Pressable, RefreshControl, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Bell, Camera, ChevronRight, Image, Mic, Shield } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppScrollView as ScrollView, BackHeader } from "../../../../shared/components";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { tokens } from "../../../../shared/theme";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { usePermissionsScreenState } from "../../application/usePermissionsScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "Permissions">;

const ICONS = {
  camera: <Camera size={18} color={tokens.colors.primary} strokeWidth={1.8} />,
  microphone: <Mic size={18} color={tokens.colors.primary} strokeWidth={1.8} />,
  notifications: <Bell size={18} color={tokens.colors.primary} strokeWidth={1.8} />,
  photos: <Image size={18} color={tokens.colors.primary} strokeWidth={1.8} />,
} as const;

const STATUS_COLORS = {
  denied: { bg: tokens.colors.dangerSoft, fg: tokens.colors.danger },
  granted: { bg: tokens.colors.successSoft, fg: tokens.colors.successIcon },
  undetermined: { bg: tokens.colors.primarySofter, fg: tokens.colors.primary },
} as const;

export function PermissionsSettingsScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const bottomPadding = useBottomNavPadding(18, 32);
  const { handleBack, handlePermissionPress, isLoading, items, refreshPermissions } =
    usePermissionsScreenState({
      goBack: () => {
        if (navigation.canGoBack()) {
          navigation.goBack();
        }
      },
    });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: tokens.colors.background }} edges={["bottom"]}>
      <BackHeader title="İzinler" onBack={handleBack} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={() => {
              void refreshPermissions();
            }}
            tintColor={tokens.colors.primary}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.smPlus,
          paddingTop: tokens.spacing.md,
          paddingBottom: Math.max(bottomPadding, insets.bottom + 24),
          gap: tokens.spacing.sm,
        }}
      >
        <View
          style={{
            borderRadius: tokens.radius.card,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.surface,
            padding: tokens.spacing.md,
            gap: tokens.spacing.xs,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.compact }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: tokens.radius.control,
                backgroundColor: tokens.colors.primarySofter,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={20} color={tokens.colors.primary} strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: tokens.colors.text,
                  fontSize: tokens.typography.subtitle,
                  fontWeight: "800",
                }}
              >
                Uygulama İzinleri
              </Text>
              <Text
                style={{
                  color: tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                  marginTop: tokens.spacing.micro,
                }}
              >
                İlk istekte sistem izni açılır. Sonraki değişiklikler için cihaz ayarları
                kullanılır.
              </Text>
            </View>
          </View>
        </View>

        {items.map((item) => {
          const colors = STATUS_COLORS[item.value];
          return (
            <Pressable
              accessibilityLabel={`${item.label}. ${item.statusTitle}. ${item.actionLabel}`}
              accessibilityRole="button"
              accessibilityState={{ busy: item.isPending }}
              key={item.id}
              onPress={() => {
                void handlePermissionPress(item.id);
              }}
              style={{
                borderRadius: tokens.radius.card,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                backgroundColor: tokens.colors.surface,
                padding: tokens.spacing.md,
                minHeight: tokens.minHeight.row,
                gap: tokens.spacing.sm,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: tokens.spacing.sm }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: tokens.radius.control,
                    backgroundColor: tokens.colors.background,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ICONS[item.id]}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      color: tokens.colors.text,
                      fontSize: tokens.typography.body,
                      fontWeight: "800",
                    }}
                  >
                    {item.label}
                  </Text>
                  <Text
                    style={{
                      color: tokens.colors.muted,
                      fontSize: tokens.typography.caption,
                      marginTop: tokens.spacing.microPlus,
                    }}
                  >
                    {item.description}
                  </Text>
                </View>
                <ChevronRight size={18} color={tokens.colors.muted} />
              </View>

              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: tokens.spacing.compact,
                }}
              >
                <View
                  style={{
                    borderRadius: tokens.radius.pill,
                    backgroundColor: colors.bg,
                    paddingHorizontal: tokens.spacing.compact,
                    paddingVertical: tokens.spacing.xsMinus,
                  }}
                >
                  <Text
                    style={{
                      color: colors.fg,
                      fontSize: tokens.typography.caption,
                      fontWeight: "800",
                    }}
                  >
                    {item.statusTitle}
                  </Text>
                </View>

                <View
                  style={{
                    minWidth: 80,
                    minHeight: tokens.minHeight.row,
                    borderRadius: tokens.radius.md,
                    backgroundColor: tokens.colors.background,
                    paddingHorizontal: tokens.spacing.sm,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: tokens.spacing.xs,
                  }}
                >
                  {item.isPending ? (
                    <ActivityIndicator color={tokens.colors.primary} size="small" />
                  ) : null}
                  <Text
                    style={{
                      color: tokens.colors.foreground,
                      fontSize: tokens.typography.caption,
                      fontWeight: "800",
                    }}
                  >
                    {item.isPending ? "Bekleniyor" : item.actionLabel}
                  </Text>
                </View>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

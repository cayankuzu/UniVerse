import React from "react";
import { ActivityIndicator, Pressable, RefreshControl, Text, View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Bell, Camera, ChevronRight, Image, MapPin, Mic, Shield } from "lucide-react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { AppScrollView as ScrollView, BackHeader } from "../../../../shared/components";
import { useBottomNavPadding } from "../../../../shared/layout/bottomNavSpacing";
import { tokens } from "../../../../shared/theme";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { usePermissionsScreenState } from "../../application/usePermissionsScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "Permissions">;

const ICONS = {
  camera: <Camera size={18} color="#0284c7" strokeWidth={1.8} />,
  location: <MapPin size={18} color="#2563eb" strokeWidth={1.8} />,
  microphone: <Mic size={18} color="#ea580c" strokeWidth={1.8} />,
  notifications: <Bell size={18} color="#d97706" strokeWidth={1.8} />,
  photos: <Image size={18} color="#059669" strokeWidth={1.8} />,
} as const;

const STATUS_COLORS = {
  denied: { bg: "#fef2f2", fg: "#dc2626" },
  granted: { bg: "#ecfdf5", fg: "#059669" },
  undetermined: { bg: "#eff6ff", fg: "#2563eb" },
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
            tintColor="#2563eb"
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 14,
          paddingTop: 16,
          paddingBottom: Math.max(bottomPadding, insets.bottom + 24),
          gap: 12,
        }}
      >
        <View
          style={{
            borderRadius: 18,
            borderWidth: 1,
            borderColor: tokens.colors.border,
            backgroundColor: tokens.colors.surface,
            padding: 16,
            gap: 8,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 14,
                backgroundColor: "#eff6ff",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Shield size={20} color="#2563eb" strokeWidth={1.8} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: tokens.colors.text, fontSize: 16, fontWeight: "800" }}>
                Uygulama İzinleri
              </Text>
              <Text style={{ color: tokens.colors.muted, fontSize: 12, marginTop: 2 }}>
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
                borderRadius: 18,
                borderWidth: 1,
                borderColor: tokens.colors.border,
                backgroundColor: tokens.colors.surface,
                padding: 16,
                minHeight: tokens.minHeight.touchTarget,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 14,
                    backgroundColor: "#f8fafc",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {ICONS[item.id]}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: tokens.colors.text, fontSize: 14, fontWeight: "800" }}>
                    {item.label}
                  </Text>
                  <Text style={{ color: tokens.colors.muted, fontSize: 12, marginTop: 3 }}>
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
                  gap: 10,
                }}
              >
                <View
                  style={{
                    borderRadius: 999,
                    backgroundColor: colors.bg,
                    paddingHorizontal: 10,
                    paddingVertical: 5,
                  }}
                >
                  <Text style={{ color: colors.fg, fontSize: 11, fontWeight: "800" }}>
                    {item.statusTitle}
                  </Text>
                </View>

                <View
                  style={{
                    minWidth: 96,
                    minHeight: tokens.minHeight.touchTarget,
                    borderRadius: 12,
                    backgroundColor: "#f8fafc",
                    paddingHorizontal: 12,
                    alignItems: "center",
                    justifyContent: "center",
                    flexDirection: "row",
                    gap: 8,
                  }}
                >
                  {item.isPending ? <ActivityIndicator color="#2563eb" size="small" /> : null}
                  <Text style={{ color: "#0f172a", fontSize: 12, fontWeight: "800" }}>
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

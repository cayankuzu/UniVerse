import { LinearGradient } from "expo-linear-gradient";
import { Bell, Camera, Image, MapPin, Mic, Shield } from "lucide-react-native";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, Linking, Pressable, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppModalHost, AppScrollView as ScrollView } from "../../../../shared/components";
import {
  DEVICE_PERMISSION_DETAILS,
  type DevicePermissionKey,
  type DevicePermissionState,
  readDevicePermissionStateProgressively,
  requestDevicePermission,
  toPermissionSnapshot,
} from "../../../../platform/permissions/devicePermissions";
import { t } from "../../../../shared/i18n";
import { tokens } from "../../../../shared/theme";
import type { PermissionSnapshot } from "../../domain";
import { PermissionItem } from "./PermissionItem";

const DEFAULT_STATE: DevicePermissionState = {
  camera: "undetermined",
  location: "undetermined",
  microphone: "undetermined",
  notifications: "undetermined",
  photos: "undetermined",
};

const ICONS: Record<DevicePermissionKey, ReactNode> = {
  camera: <Camera size={tokens.iconSize.xl} color="#38bdf8" strokeWidth={1.5} />,
  location: (
    <MapPin size={tokens.iconSize.xl} color={tokens.colors.primaryLight} strokeWidth={1.5} />
  ),
  microphone: <Mic size={tokens.iconSize.xl} color="#f97316" strokeWidth={1.5} />,
  notifications: <Bell size={tokens.iconSize.xl} color={tokens.colors.amber} strokeWidth={1.5} />,
  photos: <Image size={tokens.iconSize.xl} color={tokens.colors.emerald} strokeWidth={1.5} />,
};

interface Props {
  visible: boolean;
  onComplete: (snapshot: PermissionSnapshot, options?: { suppressPrompt?: boolean }) => void;
}

function statusLabel(status: DevicePermissionState[DevicePermissionKey]): string {
  if (status === "granted") return t("permissions.status.granted");
  if (status === "denied") return t("permissions.status.denied");
  return t("permissions.status.notAsked");
}

export function PermissionsScreen({ visible, onComplete }: Props) {
  const syncSequenceRef = useRef(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const [state, setState] = useState<DevicePermissionState>(DEFAULT_STATE);

  const syncCurrentState = useCallback(async () => {
    const syncSequence = syncSequenceRef.current + 1;
    syncSequenceRef.current = syncSequence;
    const nextState = await readDevicePermissionStateProgressively((partialState) => {
      if (syncSequenceRef.current !== syncSequence) return;
      setState((current) => ({ ...current, ...partialState }));
    });
    if (syncSequenceRef.current !== syncSequence) return;
    setState(nextState);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setDontShowAgain(false);
    void syncCurrentState();
  }, [syncCurrentState, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        void syncCurrentState();
      }
    });
    return () => subscription.remove();
  }, [syncCurrentState, visible]);

  const requestPermission = useCallback(
    async (id: DevicePermissionKey) => {
      if (state[id] !== "undetermined") {
        await Linking.openSettings();
        return;
      }
      const nextStatus = await requestDevicePermission(id);
      setState((previous) => ({ ...previous, [id]: nextStatus }));
    },
    [state],
  );

  const grantedCount = useMemo(
    () => Object.values(state).filter((value) => value === "granted").length,
    [state],
  );
  const progress = grantedCount / DEVICE_PERMISSION_DETAILS.length;

  const handleContinue = useCallback(() => {
    onComplete(toPermissionSnapshot(state), {
      suppressPrompt: dontShowAgain,
    });
  }, [dontShowAgain, onComplete, state]);

  return (
    <AppModalHost
      accessibilityAnnouncement={t("permissions.title")}
      visible={visible}
      animationType="none"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={handleContinue}
    >
      <LinearGradient
        colors={[tokens.colors.dark900, tokens.colors.dark800, tokens.colors.dark900]}
        style={{ flex: 1 }}
      >
        <SafeAreaView style={{ flex: 1 }} edges={["top", "bottom"]}>
          <ScrollView
            contentContainerStyle={{
              flexGrow: 1,
              paddingHorizontal: tokens.spacing.xl,
              paddingTop: tokens.spacing.sm,
              paddingBottom: tokens.spacing.lg,
            }}
            showsVerticalScrollIndicator={false}
          >
            <View style={{ alignItems: "center", marginBottom: tokens.spacing.xxl }}>
              <LinearGradient
                colors={[tokens.colors.primaryLight, tokens.colors.primary]}
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: tokens.radius["2xl"],
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: tokens.spacing.md,
                  shadowColor: tokens.colors.primary,
                  shadowOpacity: 0.4,
                  shadowRadius: 20,
                  elevation: 8,
                }}
              >
                <Shield
                  size={tokens.iconSize["4xl"]}
                  color={tokens.colors.surface}
                  strokeWidth={1.5}
                />
              </LinearGradient>
              <Text
                style={{
                  fontSize: tokens.typography.heading,
                  fontWeight: tokens.fontWeight.extrabold,
                  color: tokens.colors.surface,
                  letterSpacing: -0.5,
                }}
              >
                {t("permissions.title")}
              </Text>
              <Text
                style={{
                  marginTop: tokens.spacing.xs,
                  fontSize: tokens.typography.body,
                  color: "rgba(255,255,255,0.6)",
                  textAlign: "center",
                  lineHeight: 20,
                }}
              >
                {t("permissions.subtitle")}
              </Text>
            </View>

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: tokens.spacing.xs,
                marginBottom: tokens.spacing.xl,
              }}
            >
              <View
                style={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: "rgba(255,255,255,0.1)",
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: "100%",
                    width: `${progress * 100}%`,
                    borderRadius: 3,
                    backgroundColor: tokens.colors.primaryLight,
                  }}
                />
              </View>
              <Text
                style={{
                  fontSize: tokens.typography.caption,
                  fontWeight: tokens.fontWeight.semibold,
                  color: "rgba(255,255,255,0.5)",
                }}
              >
                {t("permissions.progress", {
                  granted: grantedCount,
                  total: DEVICE_PERMISSION_DETAILS.length,
                })}
              </Text>
            </View>

            <View style={{ gap: 10 }}>
              {DEVICE_PERMISSION_DETAILS.map((permission) => (
                <PermissionItem
                  key={permission.id}
                  icon={ICONS[permission.id]}
                  label={permission.label}
                  description={permission.description}
                  granted={state[permission.id] === "granted"}
                  statusLabel={statusLabel(state[permission.id])}
                  onToggle={() => {
                    void requestPermission(permission.id);
                  }}
                />
              ))}
            </View>

            <Pressable
              onPress={() => setDontShowAgain((current) => !current)}
              style={{
                marginTop: 18,
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                borderRadius: 14,
                paddingHorizontal: 14,
                paddingVertical: tokens.spacing.sm,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.12)",
                backgroundColor: "rgba(255,255,255,0.04)",
              }}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  borderWidth: 1.5,
                  borderColor: dontShowAgain ? "#60a5fa" : "rgba(255,255,255,0.35)",
                  backgroundColor: dontShowAgain ? tokens.colors.primary : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {dontShowAgain ? (
                  <Text
                    style={{
                      color: tokens.colors.surface,
                      fontSize: tokens.typography.caption,
                      fontWeight: "900",
                    }}
                  >
                    ✓
                  </Text>
                ) : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    color: tokens.colors.surface,
                    fontSize: 13,
                    fontWeight: tokens.fontWeight.bold,
                  }}
                >
                  {t("permissions.dontShowAgain")}
                </Text>
                <Text
                  style={{
                    color: "rgba(255,255,255,0.55)",
                    fontSize: tokens.typography.tiny,
                    marginTop: 2,
                  }}
                >
                  {t("permissions.dontShowAgain.hint")}
                </Text>
              </View>
            </Pressable>

            <TouchableOpacity
              onPress={handleContinue}
              style={{ marginTop: tokens.spacing.xl }}
              activeOpacity={0.85}
            >
              {grantedCount > 0 ? (
                <LinearGradient
                  colors={[tokens.colors.primaryLight, tokens.colors.primary]}
                  style={{
                    borderRadius: tokens.radius.lg,
                    padding: tokens.spacing.md,
                    alignItems: "center",
                    shadowColor: tokens.colors.primary,
                    shadowOpacity: 0.4,
                    shadowRadius: 12,
                    elevation: 6,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: tokens.fontWeight.bold,
                      color: tokens.colors.surface,
                    }}
                  >
                    {t("common.continue")}
                  </Text>
                </LinearGradient>
              ) : (
                <View
                  style={{
                    borderRadius: tokens.radius.lg,
                    padding: tokens.spacing.md,
                    alignItems: "center",
                    backgroundColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: tokens.fontWeight.bold,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    {t("permissions.closeForNow")}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            <Text
              style={{
                marginTop: tokens.spacing.sm,
                textAlign: "center",
                fontSize: tokens.typography.tiny,
                color: "rgba(255,255,255,0.3)",
              }}
            >
              {t("permissions.settingsHint")}
            </Text>
          </ScrollView>
        </SafeAreaView>
      </LinearGradient>
    </AppModalHost>
  );
}

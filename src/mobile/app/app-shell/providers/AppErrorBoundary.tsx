import React from "react";
import { AppText as Text } from "../../shared/components/AppText";
import { Pressable, View } from "react-native";
import { logError, Sentry } from "../../platform/observability";
import { tokens } from "../../shared/theme";

interface AppErrorBoundaryProps {
  children: React.ReactNode;
}

function formatComponentStackPreview(componentStack: string | undefined) {
  return String(componentStack || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join(" | ");
}

export function AppErrorBoundary({ children }: AppErrorBoundaryProps) {
  return (
    <Sentry.ErrorBoundary
      onError={(error, componentStack, eventId) => {
        const componentStackPreview = formatComponentStackPreview(componentStack);
        logError(error, {
          captureInSentry: false,
          meta: {
            componentStackPreview: componentStackPreview || undefined,
            eventId: eventId || undefined,
            operation: "render-boundary",
            scope: "app-root",
          },
          name: "error-boundary",
          screenKey: "app-root",
        });
      }}
      fallback={({ error, resetError, componentStack, eventId }) => (
        <View
          style={{
            alignItems: "center",
            backgroundColor: tokens.colors.background,
            flex: 1,
            gap: tokens.spacing.smPlus,
            justifyContent: "center",
            paddingHorizontal: tokens.spacing.xl,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: tokens.colors.foreground,
              fontSize: tokens.typography.sectionTitle,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            Beklenmeyen bir hata olustu
          </Text>
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.body,
              lineHeight: tokens.lineHeight.body,
              textAlign: "center",
            }}
          >
            {"Uygulama hatası Sentry'ye gönderildi. Tekrar denemek için ekranı yenileyin."}
          </Text>
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: tokens.typography.caption,
              textAlign: "center",
            }}
          >
            {String((error as { message?: string } | undefined)?.message || "unknown")}
          </Text>
          {eventId ? (
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.tiny,
                textAlign: "center",
              }}
            >
              {`eventId: ${eventId}`}
            </Text>
          ) : null}
          {componentStack ? (
            <Text
              style={{
                color: tokens.colors.dark600,
                fontSize: tokens.typography.tiny,
                textAlign: "center",
              }}
            >
              {formatComponentStackPreview(componentStack)}
            </Text>
          ) : null}
          <Pressable
            accessibilityLabel="Yeniden dene"
            accessibilityRole="button"
            onPress={resetError}
            style={{
              alignItems: "center",
              backgroundColor: tokens.colors.primary,
              borderRadius: tokens.radius.md,
              justifyContent: "center",
              minHeight: tokens.minHeight.buttonLg,
              paddingHorizontal: tokens.spacing.mdPlus,
            }}
          >
            <Text
              style={{
                color: tokens.colors.surface,
                fontSize: tokens.typography.body,
                fontWeight: "700",
              }}
            >
              Yeniden dene
            </Text>
          </Pressable>
        </View>
      )}
    >
      {children}
    </Sentry.ErrorBoundary>
  );
}

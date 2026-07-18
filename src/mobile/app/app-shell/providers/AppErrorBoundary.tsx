import React from "react";
import { Pressable, Text, View } from "react-native";
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
            gap: 14,
            justifyContent: "center",
            paddingHorizontal: 24,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{
              color: tokens.colors.foreground,
              fontSize: 20,
              fontWeight: "800",
              textAlign: "center",
            }}
          >
            Beklenmeyen bir hata olustu
          </Text>
          <Text
            style={{
              color: tokens.colors.muted,
              fontSize: 14,
              lineHeight: 20,
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
              borderRadius: 12,
              justifyContent: "center",
              minHeight: tokens.minHeight.touchTarget,
              paddingHorizontal: 18,
            }}
          >
            <Text style={{ color: tokens.colors.surface, fontSize: 14, fontWeight: "700" }}>
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

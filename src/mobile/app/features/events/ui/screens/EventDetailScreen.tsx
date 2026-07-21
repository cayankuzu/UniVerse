import React from "react";
import { RefreshControl } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { SafeAreaView } from "react-native-safe-area-context";
import { tokens } from "../../../../shared/theme";
import { useAuth } from "../../../../app-shell/auth";
import {
  useOpenAlbumView,
  useOpenProfileWithOptions,
} from "../../../../app-shell/navigation/hooks/useIntentNavigation";
import type { RootStackParamList } from "../../../../app-shell/navigation/types";
import { t } from "../../../../shared/i18n";
import {
  AppListSkeleton,
  AppScrollView as ScrollView,
  AsyncState,
  BackHeader,
  FeedToast,
} from "../../../../shared/components";
import { EventDetailCard } from "../../../content-cards/public/cards";
import { useEventDetailScreenState } from "../../application/useEventDetailScreenState";

type Props = NativeStackScreenProps<RootStackParamList, "EventDetail">;

export function EventDetailScreen({ route, navigation }: Props) {
  const eventId = String(route.params?.eventId || "").trim();
  const { accountType, userData } = useAuth();
  const [warningMessage, setWarningMessage] = React.useState<string | null>(null);
  const state = useEventDetailScreenState(eventId, {
    openAlbumView: useOpenAlbumView(navigation, userData),
    openProfile: useOpenProfileWithOptions(navigation, userData, { method: "push" }),
    userData,
  });
  const refreshControl = (
    <RefreshControl
      refreshing={state.detailProjection.refreshing}
      onRefresh={state.onRefresh}
      tintColor={tokens.colors.primary}
    />
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.surfaceVariant }}
      edges={["top"]}
    >
      <BackHeader title={t("events.detail.title")} onBack={() => navigation.goBack()} />

      <ScrollView
        alwaysBounceVertical
        overScrollMode="always"
        refreshControl={refreshControl}
        contentContainerStyle={
          state.event
            ? {
                paddingHorizontal: tokens.spacing.sm,
                paddingTop: tokens.spacing.xs,
                paddingBottom: tokens.spacing.mdPlus,
              }
            : {
                flexGrow: 1,
                justifyContent: "center",
                paddingHorizontal: tokens.spacing.xl,
                paddingBottom: tokens.spacing.mdPlus,
              }
        }
      >
        <AsyncState
          loading={state.loading}
          error={state.errorMessage}
          empty={state.isEmpty}
          emptyText={t("events.detail.empty")}
          loadingFallback={<AppListSkeleton count={1} itemHeight={420} variant="list" />}
        >
          {state.event ? (
            <EventDetailCard
              accountType={accountType}
              event={state.event}
              onOpenAlbum={state.openAlbumView}
              onOpenClub={state.openProfile}
              onShowWarning={setWarningMessage}
              relations={state.relation}
              viewer={userData}
            />
          ) : null}
        </AsyncState>
      </ScrollView>

      <FeedToast message={warningMessage} />
    </SafeAreaView>
  );
}

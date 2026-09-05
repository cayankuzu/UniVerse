import type { ReactElement, RefObject } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import { ArrowLeft, X } from "lucide-react-native";
import { Pressable, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFlatList, type AppFlatListRef } from "../../../../shared/components";
import { tokens, withAlpha } from "../../../../shared/theme";

type DetailViewerOverlayLayoutProps<T extends { id: string }> = {
  contentContainerStyle: ViewStyle;
  data: T[];
  estimatedItemSize: number;
  focusedItem: T | null;
  headerTitle: string;
  initialScrollIndex: number;
  listInstanceKey: string;
  listRef: RefObject<AppFlatListRef<T> | null>;
  onClose: () => void;
  onRefresh?: () => Promise<void> | void;
  refreshing: boolean;
  renderCard: (item: T) => ReactElement;
  showList: boolean;
  visible: boolean;
};

export function DetailViewerOverlayLayout<T extends { id: string }>(
  props: DetailViewerOverlayLayoutProps<T>,
) {
  if (!props.visible) return null;

  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 30 }}
    >
      <View style={{ flex: 1, backgroundColor: withAlpha(tokens.colors.dark950, 0.28) }}>
        <SafeAreaView
          style={{ flex: 1, backgroundColor: tokens.colors.background }}
          edges={["top"]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: tokens.spacing.compact,
              paddingHorizontal: tokens.spacing.compact,
              paddingVertical: tokens.spacing.xs,
              borderBottomWidth: 1,
              borderBottomColor: tokens.colors.border,
              backgroundColor: tokens.colors.onMedia,
            }}
          >
            <Pressable
              onPress={props.onClose}
              accessibilityRole="button"
              accessibilityLabel="Geri dön"
              hitSlop={tokens.hitSlop.sm}
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                backgroundColor: tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={18} color={tokens.colors.dark700} />
            </Pressable>

            <Text
              style={{
                flex: 1,
                color: tokens.colors.foreground,
                fontSize: tokens.typography.control,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              {props.headerTitle}
            </Text>

            <Pressable
              onPress={props.onClose}
              accessibilityRole="button"
              accessibilityLabel="Kapat"
              hitSlop={tokens.hitSlop.sm}
              style={{
                width: 32,
                height: 32,
                borderRadius: tokens.radius.pill,
                backgroundColor: tokens.colors.surfaceVariant,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color={tokens.colors.muted} />
            </Pressable>
          </View>

          {props.showList ? (
            <AppFlatList
              key={props.listInstanceKey}
              ref={props.listRef}
              contentContainerStyle={props.contentContainerStyle}
              data={props.data}
              estimatedItemSize={props.estimatedItemSize}
              initialScrollIndex={props.initialScrollIndex}
              keyExtractor={(item) => item.id}
              onRefresh={props.onRefresh}
              performanceTier="tier3"
              refreshing={props.refreshing}
              renderItem={({ item }) => props.renderCard(item)}
            />
          ) : props.focusedItem ? (
            <View style={props.contentContainerStyle}>{props.renderCard(props.focusedItem)}</View>
          ) : null}
        </SafeAreaView>
      </View>
    </View>
  );
}

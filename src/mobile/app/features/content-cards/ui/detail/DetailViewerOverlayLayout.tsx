import type { ReactElement, RefObject } from "react";
import { ArrowLeft, X } from "lucide-react-native";
import { Pressable, Text, View, type ViewStyle } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppFlatList, type AppFlatListRef } from "../../../../shared/components";

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
      <View style={{ flex: 1, backgroundColor: "rgba(2,6,23,0.28)" }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top"]}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 10,
              paddingVertical: 8,
              borderBottomWidth: 1,
              borderBottomColor: "#e2e8f0",
              backgroundColor: "#fff",
            }}
          >
            <Pressable
              onPress={props.onClose}
              style={{
                width: 36,
                height: 36,
                borderRadius: 11,
                backgroundColor: "#f1f5f9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ArrowLeft size={18} color="#334155" />
            </Pressable>

            <Text
              style={{ flex: 1, color: "#0f172a", fontSize: 15, fontWeight: "700" }}
              numberOfLines={1}
            >
              {props.headerTitle}
            </Text>

            <Pressable
              onPress={props.onClose}
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: "#f1f5f9",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color="#64748b" />
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

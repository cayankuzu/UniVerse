import { Pressable, Text, View } from "react-native";
import { Check, Copy } from "lucide-react-native";
import type { EventWithMeta } from "../../data";
import { AppModalHost } from "../../../../shared/components";

type Props = {
  copiedField: "location" | "address" | null;
  event: EventWithMeta;
  modalBottomPadding: number;
  onClose: () => void;
  onCopyText: (value: string, field: "location" | "address") => Promise<void>;
  visible: boolean;
};

export function EventDetailLocationModal({
  copiedField,
  event,
  modalBottomPadding,
  onClose,
  onCopyText,
  visible,
}: Props) {
  return (
    <AppModalHost
      accessibilityAnnouncement="Konum bilgisi"
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: "rgba(2,6,23,0.45)",
          justifyContent: "flex-end",
          paddingHorizontal: 12,
          paddingTop: 12,
          paddingBottom: modalBottomPadding,
        }}
      >
        <Pressable
          onPress={(eventPress) => eventPress.stopPropagation()}
          style={{
            borderRadius: 16,
            backgroundColor: "#fff",
            borderWidth: 1,
            borderColor: "#e2e8f0",
            padding: 14,
            gap: 8,
          }}
        >
          <View
            style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
          >
            <Text style={{ color: "#0f172a", fontSize: 15, fontWeight: "700" }}>Konum</Text>
            <CopyIconButton
              copied={copiedField === "location"}
              disabled={!String(event.location || "").trim()}
              onPress={() => void onCopyText(event.location || "", "location")}
            />
          </View>
          <Text style={{ color: "#334155", fontSize: 14, fontWeight: "700" }}>
            {event.location || "-"}
          </Text>
          <Text style={{ color: "#64748b", fontSize: 12 }}>{event.university || ""}</Text>
          <View style={{ marginTop: 2, gap: 6 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Text style={{ color: "#94a3b8", fontSize: 11, fontWeight: "700" }}>Adres</Text>
              <CopyIconButton
                copied={copiedField === "address"}
                disabled={!String(event.address || event.location || "").trim()}
                onPress={() => void onCopyText(event.address || event.location || "", "address")}
              />
            </View>
            <Text style={{ color: "#475569", fontSize: 12, lineHeight: 18 }}>
              {event.address || event.location || "-"}
            </Text>
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}

type CopyIconButtonProps = {
  copied: boolean;
  disabled: boolean;
  onPress: () => void;
};

function CopyIconButton({ copied, disabled, onPress }: CopyIconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#f8fafc",
        borderWidth: 1,
        borderColor: "#e2e8f0",
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {copied ? <Check size={14} color="#059669" /> : <Copy size={14} color="#64748b" />}
    </Pressable>
  );
}

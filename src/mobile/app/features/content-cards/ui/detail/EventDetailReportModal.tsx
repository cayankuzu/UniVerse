import { Pressable, Text, View } from "react-native";
import { AppModalHost } from "../../../../shared/components";

type Props = {
  modalBottomPadding: number;
  onClose: () => void;
  onReport: (reason: string) => Promise<void>;
  reportSubmitted: boolean;
  visible: boolean;
};

const REPORT_REASONS = [
  "Uygunsuz içerik",
  "Spam veya yanıltıcı",
  "Nefret söylemi",
  "Sahte etkinlik",
  "Diğer",
] as const;

export function EventDetailReportModal({
  modalBottomPadding,
  onClose,
  onReport,
  reportSubmitted,
  visible,
}: Props) {
  return (
    <AppModalHost
      accessibilityAnnouncement="Etkinliği şikayet et"
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
            overflow: "hidden",
          }}
        >
          <View style={{ paddingHorizontal: 14, paddingTop: 14, paddingBottom: 8 }}>
            {reportSubmitted ? (
              <>
                <Text
                  style={{ color: "#0f172a", fontSize: 16, fontWeight: "800", textAlign: "center" }}
                >
                  Bildirim gönderildi
                </Text>
                <Text
                  style={{
                    color: "#64748b",
                    fontSize: 12,
                    textAlign: "center",
                    marginTop: 6,
                    marginBottom: 8,
                  }}
                >
                  Inceleme icin ekibe iletildi.
                </Text>
              </>
            ) : (
              <>
                <Text
                  style={{
                    color: "#0f172a",
                    fontSize: 16,
                    fontWeight: "800",
                    textAlign: "center",
                    marginBottom: 10,
                  }}
                >
                  Sikayet et
                </Text>
                {REPORT_REASONS.map((reason, index) => (
                  <Pressable
                    key={reason}
                    onPress={() => void onReport(reason)}
                    style={{
                      minHeight: 44,
                      paddingHorizontal: 12,
                      flexDirection: "row",
                      alignItems: "center",
                      borderTopWidth: index === 0 ? 0 : 1,
                      borderTopColor: "#f1f5f9",
                    }}
                  >
                    <Text style={{ color: "#334155", fontSize: 13, fontWeight: "600" }}>
                      {reason}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={onClose}
                  style={{
                    minHeight: 44,
                    borderTopWidth: 1,
                    borderTopColor: "#f1f5f9",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#64748b", fontSize: 13, fontWeight: "700" }}>Vazgec</Text>
                </Pressable>
              </>
            )}
          </View>
        </Pressable>
      </Pressable>
    </AppModalHost>
  );
}

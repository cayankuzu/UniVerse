import { Text, View } from "react-native";
import type { EventWithMeta } from "../../data";
import { HomeEventCard } from "../../../content-cards/public/cards";
import { EventFormSection } from "./EventFormSection";
import type { CreateEventFormState } from "../../domain";
import { tokens } from "../../../../shared/theme";
import { t } from "../../../../shared/i18n";

const PREVIEW_VIEWER = {
  id: "preview-viewer",
  clubName: "Kulüp",
  name: "Kulüp",
  profileImage: "",
  university: "Üniversite",
  username: "kulüp",
} as const;

interface Props {
  form: CreateEventFormState;
  coverImageUri: string;
  selectedCategories: string[];
  uploadProgress: string;
  submitError: string;
  clubDisplayName: string;
  clubUsername: string;
  clubImage: string;
  university: string;
}

function buildPreviewEvent({
  form,
  coverImageUri,
  selectedCategories,
  clubDisplayName,
  clubUsername,
  clubImage,
  university,
}: Omit<Props, "uploadProgress" | "submitError">): EventWithMeta {
  const nowIso = new Date().toISOString();
  const categoryList = selectedCategories.length > 0 ? selectedCategories : ["Genel"];
  const capacity = Math.max(parseInt(form.capacity, 10) || 100, 1);

  return {
    id: "create-event-preview",
    clubUserId: "preview-club",
    clubUsername: clubUsername || "kulüp",
    club: clubDisplayName || "Kulüp",
    clubImage: clubImage || "",
    university: university || "Üniversite",
    title: form.title.trim() || "Etkinlik Başlığı",
    description: form.description.trim() || "Etkinlik açıklaması burada görünecek.",
    image: coverImageUri || "",
    date: form.startDate || nowIso.slice(0, 10),
    startDate: form.startDate || nowIso.slice(0, 10),
    endDate: form.endDate || form.startDate || nowIso.slice(0, 10),
    startTime: form.startTime || "10:00",
    endTime: form.endTime || "12:00",
    location: form.location || "Konum belirtilmedi",
    address: form.address || form.location || "Adres belirtilmedi",
    type: form.type || "Etkinlik",
    access: form.access || "Herkese Açık",
    fee: form.fee === "Ücretli" && form.feeAmount ? `${form.feeAmount} TL` : form.fee || "Ücretsiz",
    capacity,
    targetAudience: form.targetAudience || "",
    level: form.level || "",
    materials: form.materials || "",
    visibility: "public",
    category: categoryList[0],
    categories: categoryList,
    createdAt: nowIso,
    likes: 0,
    liked: false,
    attendees: 0,
    joined: false,
    clubIsPrivate: false,
    effectiveVisibility: "public",
  };
}

export function CreateEventStepPreview(props: Props) {
  const event = buildPreviewEvent(props);

  return (
    <EventFormSection
      title={t("events.create.preview.title")}
      subtitle={t("events.create.preview.subtitle")}
    >
      <View>
        <HomeEventCard
          accountType="club"
          event={event}
          interactive={false}
          allowInfoActions
          viewer={PREVIEW_VIEWER}
        />
      </View>

      {props.uploadProgress ? (
        <Text
          style={{
            color: tokens.colors.primary,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.semibold,
          }}
        >
          {props.uploadProgress}
        </Text>
      ) : null}

      {props.submitError ? (
        <Text
          style={{
            color: tokens.colors.danger,
            fontSize: tokens.typography.caption,
            fontWeight: tokens.fontWeight.semibold,
          }}
        >
          {props.submitError}
        </Text>
      ) : null}
    </EventFormSection>
  );
}

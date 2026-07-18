import type { EventWithMeta } from "../../../data/contracts/content";
import { resolveVisibilityFromAccess } from "../../../data/policies/eventAccess";
import type { CreateEventFormState } from "../domain/createEventForm";

type CurrentUser = {
  clubName?: string;
  id?: string;
  name?: string;
  profileImage?: string;
  university?: string;
  username?: string;
};

export function buildOptimisticEvent(params: {
  coverImageUri: string;
  form: CreateEventFormState;
  selectedCategories: string[];
  tempId: string;
  userData: CurrentUser;
}): EventWithMeta {
  const visibility = resolveVisibilityFromAccess(params.form.access);
  return {
    access: params.form.access,
    address: params.form.address.trim() || params.form.location.trim(),
    attendees: 0,
    capacity: parseInt(params.form.capacity, 10) || 100,
    categories: params.selectedCategories,
    category: params.selectedCategories[0] || "Genel",
    club: params.userData.clubName || params.userData.name || params.userData.username || "Kulüp",
    clubImage: params.userData.profileImage || "",
    clubUserId: params.userData.id || "",
    clubUsername: params.userData.username || "",
    comments: 0,
    createdAt: new Date().toISOString(),
    date: params.form.startDate.trim(),
    description: params.form.description.trim(),
    effectiveVisibility: visibility,
    endDate: (params.form.endDate || params.form.startDate).trim(),
    endTime: params.form.endTime.trim() || "12:00",
    fee:
      params.form.fee === "Ücretli" && params.form.feeAmount
        ? `${params.form.feeAmount} TL`
        : params.form.fee,
    id: params.tempId,
    image: params.coverImageUri || "",
    joined: false,
    level: params.form.level,
    liked: false,
    likes: 0,
    location: params.form.location.trim(),
    materials: params.form.materials.trim(),
    startDate: params.form.startDate.trim(),
    startTime: params.form.startTime.trim() || "10:00",
    targetAudience: params.form.targetAudience.trim(),
    title: params.form.title.trim(),
    type: params.form.type,
    university: params.userData.university || "",
    visibility,
  };
}

import type { CreateEventFormState } from "../domain/createEventForm";

export type EventCreateQueueUser = {
  clubName?: string;
  id?: string;
  name?: string;
  profileImage?: string;
  university?: string;
  username?: string;
};

export type EventCreateQueuePayload = {
  clientMutationId: string;
  coverImageUri: string;
  form: CreateEventFormState;
  selectedCategories: string[];
  userData: EventCreateQueueUser;
};

export const DEFAULT_EVENT_SEARCH_SCOPE = JSON.stringify({
  category: "",
  fee: "",
  q: "",
  sort: "newest",
  university: "",
});

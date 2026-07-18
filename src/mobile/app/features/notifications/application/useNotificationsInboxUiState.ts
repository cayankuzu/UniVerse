import { useState } from "react";
import type { FilterCategory } from "./notificationsPresentation";
import { useNotificationNotice } from "./useNotificationNotice";

export function useNotificationsInboxUiState() {
  const { notice, pushNotice } = useNotificationNotice();
  const [activeFilter, setActiveFilter] = useState<FilterCategory>("all");

  return {
    activeFilter,
    notice,
    pushNotice,
    setActiveFilter,
  };
}

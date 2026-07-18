import type { AccountType, ContentViewer, EventWithMeta, RelationSnapshot } from "../../data";
import type {
  PreparedEventAccessChip,
  PreparedEventInfoSlide,
  PreparedEventMetaChip,
} from "../../application/feedCardPresentation";
import type { TourAnchorRenderer } from "../tourAnchorRenderer";

export type HomeEventCardPresentation = {
  accessChip: PreparedEventAccessChip;
  albumCount: number;
  avatarInitials: string;
  clubSubtitle: string;
  createdAtDateLabel: string;
  createdAtTimeLabel: string;
  infoSlides: PreparedEventInfoSlide[];
  metaChips: PreparedEventMetaChip[];
};

export interface HomeEventCardProps {
  accountType: AccountType;
  highPriority?: boolean;
  imageVariant?: "thumbnail" | "medium" | "full";
  event: EventWithMeta;
  presentation?: HomeEventCardPresentation;
  onOpenCard?: (id: string) => void;
  onOpenAlbum?: (id: string) => void;
  onOpenClub?: (username: string) => void;
  onOpenComments?: () => void;
  onOpenLikes?: () => void;
  onOpenAttendees?: () => void;
  onOpenLocation?: () => void;
  onShowWarning?: (message: string) => void;
  relations?: RelationSnapshot;
  isTourTarget?: boolean;
  interactive?: boolean;
  allowInfoActions?: boolean;
  deferModalActions?: boolean;
  renderTourAnchor?: TourAnchorRenderer;
  viewer: ContentViewer;
}

export type EventFeedPatch = Partial<
  Pick<EventWithMeta, "liked" | "likes" | "joined" | "attendees">
> & {
  comments?: number;
};

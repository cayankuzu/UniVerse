import type { AccountType, NotificationType } from "../contracts/api";

export interface Notification {
  id: string;
  type: NotificationType;
  fromUserId: string;
  fromUsername: string;
  fromName: string;
  fromImage: string;
  message: string;
  detail?: string;
  contentTitle?: string;
  contentSubtitle?: string;
  eventTitle?: string;
  eventId?: string;
  photoId?: string;
  targetType: "event" | "profile" | "album";
  read: boolean;
  requestStatus?: "pending" | "accepted" | "rejected";
  requestResolvedAt?: string;
  createdAt: string;
  time: string;
}

export interface FollowRequest {
  fromUserId: string;
  fromUsername: string;
  fromName: string;
  fromImage: string;
  fromAccountType: AccountType;
  sentAt: string;
}

export interface UIFollowRequest {
  fromUserId?: string;
  notificationId?: string;
  requestKey?: string;
  username: string;
  name: string;
  image: string;
  requestStatus?: "pending" | "accepted" | "rejected";
  university?: string;
  time: string;
  accountType: AccountType;
}

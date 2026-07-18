import type { AccountType, EventVisibility, ImageVariants } from "./api";

export interface AuthUserData {
  id?: string;
  username: string;
  name?: string;
  clubName?: string;
  email: string;
  university: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  description?: string;
  profileImage: string;
  coverImage: string;
  profileImageVariants?: ImageVariants;
  coverImageVariants?: ImageVariants;
  categories: string[];
  followers: number;
  following: number;
  albums?: number;
  events: number;
  isPrivate?: boolean;
  hideEmail?: boolean;
}

export interface UserProfile {
  id: string;
  username: string;
  accountType: AccountType;
  email: string;
  university: string;
  categories: string[];
  profileImage: string;
  coverImage: string;
  profileImageVariants?: ImageVariants;
  coverImageVariants?: ImageVariants;
  isPrivate: boolean;
  hideEmail?: boolean;
  createdAt: string;
  followersCount: number;
  followingCount: number;
  albumsCount?: number;
  eventsCount?: number;
  name?: string;
  department?: string;
  gradeYear?: string;
  bio?: string;
  clubName?: string;
  description?: string;
}

export interface Event {
  id: string;
  clubUserId: string;
  clubUsername: string;
  club: string;
  clubImage: string;
  university: string;
  title: string;
  description: string;
  image: string;
  imageVariants?: ImageVariants;
  date: string;
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
  address: string;
  type: string;
  category: string;
  categories: string[];
  fee: string;
  access: string;
  capacity: number;
  targetAudience: string;
  level: string;
  materials: string;
  visibility: EventVisibility;
  createdAt: string;
  likes: number;
  liked: boolean;
  attendees: number;
  joined: boolean;
}

export type AlbumVisibilityType = "club" | "own";

export interface AlbumVisibilityLabel {
  text: string;
  type: AlbumVisibilityType;
}

export interface AlbumSurfaceVisibilitySnapshot {
  label: AlbumVisibilityLabel;
  showOnClubProfile: boolean;
  showOnOwnProfile: boolean;
  showOnProfile: boolean;
}

export interface AlbumPhoto {
  id: string;
  userId: string;
  username: string;
  name: string;
  userImage: string;
  eventId: string;
  eventTitle: string;
  image: string;
  imageVariants?: ImageVariants;
  images?: string[];
  photoCount?: number;
  title?: string;
  caption?: string;
  showOnProfile?: boolean;
  showOnOwnProfile?: boolean;
  showOnClubProfile?: boolean;
  surfaceVisibility?: AlbumSurfaceVisibilitySnapshot;
  eventVisibility?: EventVisibility;
  createdAt: string;
  likes: number;
  liked: boolean;
  comments: number;
}

export interface Comment {
  id: string;
  userId: string;
  username: string;
  name: string;
  image: string;
  university?: string;
  text: string;
  parentId: string | null;
  createdAt: string;
  time: string;
}

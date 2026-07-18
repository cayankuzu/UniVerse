import type { AccountType } from "../../../data/contracts/api";
import type { AuthUserData } from "../../../data/contracts/entities";
import type {
  FollowRequestItem,
  NotificationItem,
  SearchUserResult,
} from "../../../data/contracts/api";
import { IS_PRODUCTION_RUNTIME } from "../../../platform/config/runtime";
import { demoAvatars, demoCovers } from "../../../shared/fixtures/fixtureMedia";
import { formatAbsoluteDateTime } from "../../../shared/utils/dateTime";

function readDemoEnv(name: string, fallback = "") {
  if (IS_PRODUCTION_RUNTIME) return "";
  return String(process.env[name] || fallback).trim();
}

const DEMO_STUDENT_EMAIL = readDemoEnv("EXPO_PUBLIC_DEMO_STUDENT_EMAIL").toLowerCase();
const DEMO_STUDENT_PASSWORD = readDemoEnv("EXPO_PUBLIC_DEMO_STUDENT_PASSWORD");
const DEMO_CLUB_EMAIL = readDemoEnv("EXPO_PUBLIC_DEMO_CLUB_EMAIL").toLowerCase();
const DEMO_CLUB_PASSWORD = readDemoEnv("EXPO_PUBLIC_DEMO_CLUB_PASSWORD");

export const DEMO_CREDENTIALS = [
  { email: DEMO_STUDENT_EMAIL, password: DEMO_STUDENT_PASSWORD, type: "student" as const },
  { email: DEMO_CLUB_EMAIL, password: DEMO_CLUB_PASSWORD, type: "club" as const },
].filter((item) => item.email && item.password);

export const DEMO_STUDENT_USER: AuthUserData = {
  id: "demo-student-001",
  username: "ahmet_yilmaz",
  name: "Ahmet Yilmaz",
  email: DEMO_STUDENT_EMAIL || "student-demo@example.invalid",
  university: "Orta Dogu Teknik Üniversitesi",
  department: "Bilgisayar Muhendisligi",
  gradeYear: "3. Sinif",
  bio: "Kampus etkinliklerini takip etmeyi sever.",
  profileImage: demoAvatars.ahmet,
  coverImage: demoCovers.campus,
  categories: ["Teknoloji", "Yazilim", "Yapay Zeka"],
  followers: 284,
  following: 167,
  events: 6,
  isPrivate: false,
};

export const DEMO_CLUB_USER: AuthUserData = {
  id: "demo-club-001",
  username: "ieee_odtu",
  clubName: "IEEE ODTU Öğrenci Kolu",
  email: DEMO_CLUB_EMAIL || "club-demo@example.invalid",
  university: "Orta Dogu Teknik Üniversitesi",
  description: "Teknoloji, yazilim ve muhendislik odakli Öğrenci toplulugu.",
  profileImage: demoAvatars.ieee,
  coverImage: demoCovers.club,
  categories: ["Teknoloji", "Yazilim", "Yapay Zeka"],
  followers: 1240,
  following: 58,
  events: 18,
  isPrivate: false,
};

export const DEMO_FOLLOW_REQUESTS: FollowRequestItem[] = [
  {
    username: "zeynep_k",
    name: "Zeynep Kaya",
    image: demoAvatars.zeynep,
    accountType: "student",
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 5 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
];

export const MOCK_FOLLOWERS: FollowRequestItem[] = [
  {
    username: "zeynep_k",
    name: "Zeynep Kaya",
    image: demoAvatars.zeynep,
    accountType: "student",
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
  {
    username: "deniz_y",
    name: "Deniz Yildiz",
    image: demoAvatars.deniz,
    accountType: "student",
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
];

export const MOCK_FOLLOWING: FollowRequestItem[] = [
  {
    username: "ieee_odtu",
    name: "IEEE ODTU",
    image: demoAvatars.ieee,
    accountType: "club",
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
  {
    username: "zeynep_k",
    name: "Zeynep Kaya",
    image: demoAvatars.zeynep,
    accountType: "student",
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
];

export const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "demo-n1",
    type: "follow_request",
    fromUserId: "user-zeynep",
    fromUsername: "zeynep_k",
    fromName: "Zeynep Kaya",
    fromImage: demoAvatars.zeynep,
    message: "seni takip etmek istiyor",
    targetType: "profile",
    read: false,
    createdAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 5 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
  {
    id: "demo-n2",
    type: "like",
    fromUserId: "user-deniz",
    fromUsername: "deniz_y",
    fromName: "Deniz Yildiz",
    fromImage: demoAvatars.deniz,
    message: "etkinligini beğendi",
    detail: "Yapay Zeka Giriş Atolyesi",
    targetType: "event",
    read: false,
    createdAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
    time:
      formatAbsoluteDateTime(new Date(Date.now() - 45 * 60 * 1000).toISOString()) ||
      "Tarih bilinmiyor",
  },
];

export const MOCK_DISCOVERY_USERS: SearchUserResult[] = [
  {
    id: "user-zeynep",
    username: "zeynep_k",
    name: "Zeynep Kaya",
    image: demoAvatars.zeynep,
    coverImage: demoCovers.campus,
    university: "Hacettepe Üniversitesi",
    isPrivate: false,
    department: "Tip Fakultesi",
    year: "2. Sinif",
  },
  {
    id: "club-ieee",
    username: "ieee_odtu",
    name: "IEEE ODTU",
    image: demoAvatars.ieee,
    coverImage: demoCovers.club,
    university: "Orta Dogu Teknik Üniversitesi",
    isPrivate: false,
    category: "Teknoloji",
    categories: ["Teknoloji", "Yazilim"],
    description: "ODTU IEEE Öğrenci toplulugu",
  },
];

export function buildDemoAuthState(type: "student" | "club"): {
  accountType: AccountType;
  userData: AuthUserData;
  followRequests: FollowRequestItem[];
} {
  if (type === "club") {
    return {
      accountType: "club",
      userData: DEMO_CLUB_USER,
      followRequests: [],
    };
  }

  return {
    accountType: "student",
    userData: DEMO_STUDENT_USER,
    followRequests: DEMO_FOLLOW_REQUESTS,
  };
}

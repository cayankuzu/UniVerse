import type { AccountType, FollowRequestItem } from "../../../data/contracts/api";
import type { AuthUserData } from "../../../data/contracts/entities";
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

const DEMO_STUDENT_USER: AuthUserData = {
  id: "demo-student-001",
  username: "ahmet_yilmaz",
  name: "Ahmet Yilmaz",
  email: DEMO_STUDENT_EMAIL || "student-demo@example.invalid",
  university: "Orta Dogu Teknik Üniversitesi",
  department: "Bilgisayar Muhendisligi",
  gradeYear: "3. Sinif",
  bio: "Kampüs etkinliklerini takip etmeyi sever.",
  profileImage: demoAvatars.ahmet,
  coverImage: demoCovers.campus,
  categories: ["Teknoloji", "Yazilim", "Yapay Zeka"],
  followers: 284,
  following: 167,
  events: 6,
  isPrivate: false,
};

const DEMO_CLUB_USER: AuthUserData = {
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

const DEMO_FOLLOW_REQUESTS: FollowRequestItem[] = [
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

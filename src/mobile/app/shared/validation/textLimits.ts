export const TEXT_LIMITS = {
  album: {
    caption: 600,
    maxImages: 5,
    mediaPath: 512,
    title: 120,
  },
  auth: {
    bio: 150,
    clubDescription: 200,
    clubName: 80,
    department: 80,
    email: 160,
    gradeYear: 40,
    mediaPath: 512,
    name: 80,
    registrationNonce: 160,
    university: 120,
    username: 24,
  },
  category: {
    label: 40,
    maxSelections: 8,
  },
  comment: {
    body: 500,
  },
  common: {
    id: 120,
  },
  event: {
    access: 40,
    address: 160,
    description: 2000,
    fee: 40,
    level: 40,
    location: 160,
    materials: 400,
    targetAudience: 120,
    title: 120,
    type: 40,
  },
  report: {
    detail: 1000,
    reason: 240,
    targetUsername: 120,
  },
  search: {
    query: 80,
  },
} as const;

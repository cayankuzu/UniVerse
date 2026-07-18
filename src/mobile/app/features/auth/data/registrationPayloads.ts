import type { RegisterDirectPayload, RegisterPayload } from "../../../data/auth/auth.shared";

interface StudentRegistrationValues {
  bio: string;
  department: string;
  gradeYear: string;
  name: string;
  password: string;
  university: string;
}

interface ClubRegistrationValues {
  clubName: string;
  description: string;
  password: string;
  university: string;
}

interface RegistrationPayloadParams<TValues> {
  normalizedEmail: string;
  normalizedUsername: string;
  selectedCategories: string[];
  values: TValues;
}

export function buildStudentRegistrationPayloads(
  params: RegistrationPayloadParams<StudentRegistrationValues>,
): { registerPayload: RegisterDirectPayload; updatePayload: RegisterPayload } {
  const { normalizedEmail, normalizedUsername, selectedCategories, values } = params;
  return {
    registerPayload: {
      accountType: "student",
      bio: values.bio.trim(),
      categories: selectedCategories,
      coverImage: "",
      department: values.department.trim(),
      email: normalizedEmail,
      gradeYear: values.gradeYear.trim(),
      isPrivate: false,
      name: values.name.trim(),
      password: values.password,
      profileImage: "",
      university: values.university.trim(),
      username: normalizedUsername,
    },
    updatePayload: {
      accountType: "student",
      bio: values.bio.trim(),
      categories: selectedCategories,
      clubName: "",
      coverImage: "",
      department: values.department.trim(),
      description: "",
      email: normalizedEmail,
      gradeYear: values.gradeYear.trim(),
      isPrivate: false,
      name: values.name.trim(),
      profileImage: "",
      university: values.university.trim(),
      userId: "",
      username: normalizedUsername,
    },
  };
}

export function buildClubRegistrationPayloads(
  params: RegistrationPayloadParams<ClubRegistrationValues>,
): { registerPayload: RegisterDirectPayload; updatePayload: RegisterPayload } {
  const { normalizedEmail, normalizedUsername, selectedCategories, values } = params;
  return {
    registerPayload: {
      accountType: "club",
      categories: selectedCategories,
      clubName: values.clubName.trim(),
      coverImage: "",
      description: values.description.trim(),
      email: normalizedEmail,
      isPrivate: false,
      password: values.password,
      profileImage: "",
      university: values.university.trim(),
      username: normalizedUsername,
    },
    updatePayload: {
      accountType: "club",
      bio: "",
      categories: selectedCategories,
      clubName: values.clubName.trim(),
      coverImage: "",
      department: "",
      description: values.description.trim(),
      email: normalizedEmail,
      gradeYear: "",
      isPrivate: false,
      name: "",
      profileImage: "",
      university: values.university.trim(),
      userId: "",
      username: normalizedUsername,
    },
  };
}

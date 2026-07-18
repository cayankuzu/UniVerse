import { DEPARTMENT_OPTIONS } from "./universities.departments";
import { UNIVERSITY_OPTIONS } from "./universities.institutions";
import {
  CLUB_CATEGORY_OPTIONS,
  GRADE_YEAR_OPTIONS,
  INTEREST_OPTIONS,
} from "./universities.taxonomyData";

const sortTrUnique = (items: readonly string[]) =>
  Array.from(new Set(items)).sort((a, b) => a.localeCompare(b, "tr"));
const unique = (items: readonly string[]) => Array.from(new Set(items));

export const universities = sortTrUnique(UNIVERSITY_OPTIONS);
export const departments = sortTrUnique(DEPARTMENT_OPTIONS);
export const gradeYears = unique(GRADE_YEAR_OPTIONS);
export const clubCategories = unique(CLUB_CATEGORY_OPTIONS);
export const interests = unique(INTEREST_OPTIONS);

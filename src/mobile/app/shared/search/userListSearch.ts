export type SearchableUserListItem = {
  accountType?: string | null;
  bio?: string | null;
  categories?: readonly string[] | null;
  category?: string | null;
  clubName?: string | null;
  department?: string | null;
  description?: string | null;
  name?: string | null;
  university?: string | null;
  username?: string | null;
  year?: string | null;
};

const TURKISH_SEARCH_CHARS: Record<string, string> = {
  ç: "c",
  Ç: "c",
  ğ: "g",
  Ğ: "g",
  ı: "i",
  I: "i",
  İ: "i",
  ö: "o",
  Ö: "o",
  ş: "s",
  Ş: "s",
  ü: "u",
  Ü: "u",
};

export function normalizeUserListSearchText(value: unknown) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[çÇğĞıIİöÖşŞüÜ]/g, (char) => TURKISH_SEARCH_CHARS[char] || char)
    .toLowerCase()
    .trim();
}

function getSearchFields(item: SearchableUserListItem) {
  return [
    item.name,
    item.username,
    item.clubName,
    item.university,
    item.department,
    item.year,
    item.category,
    item.accountType,
    item.bio,
    item.description,
    ...(item.categories || []),
  ];
}

export function filterUserListItems<T extends SearchableUserListItem>(
  items: readonly T[],
  query: string,
) {
  const normalizedQuery = normalizeUserListSearchText(query);
  if (!normalizedQuery) return [...items];

  return items.filter((item) =>
    getSearchFields(item).some((field) =>
      normalizeUserListSearchText(field).includes(normalizedQuery),
    ),
  );
}

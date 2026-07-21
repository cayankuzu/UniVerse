import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Path, type PathValue } from "react-hook-form";

import { categories } from "../../../shared/catalog/taxonomy";
import { formatTurkishDisplayText } from "../../../shared/i18n/turkishDisplay";
import { TEXT_LIMITS } from "../../../shared/validation/textLimits";
import {
  captureCameraImageSelection,
  type MediaSelection,
  waitForMediaPickerTransition,
} from "../../../shared/media/mediaPicker";
import { editProfileSchema, type EditProfileFormValues } from "../domain/editProfile.schema";
import { sanitizeUsername } from "../domain/editProfileForm";
import {
  EDIT_PROFILE_FIELDS,
  mapEditProfileFieldErrors,
  type EditProfileFieldName,
} from "./editProfileScreenState.shared";
import type { AuthUserData } from "../../../data/contracts/entities";

interface UseEditProfileFormStateParams {
  isClub: boolean;
  userData: AuthUserData;
}

type FieldFocusRequest = {
  fieldName: string;
  revision: number;
};

export function useEditProfileFormState({ isClub, userData }: UseEditProfileFormStateParams) {
  const [submitError, setSubmitError] = useState("");
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [categorySearch, setCategorySearch] = useState("");
  const [hideEmail, setHideEmail] = useState(Boolean(userData.hideEmail));
  const [selectedCategories, setSelectedCategories] = useState<string[]>(userData.categories ?? []);
  const [profileImageUri, setProfileImageUri] = useState<string>(userData.profileImage ?? "");
  const [coverImageUri, setCoverImageUri] = useState<string>(userData.coverImage ?? "");
  const [mediaTarget, setMediaTarget] = useState<"profile" | "cover">("profile");
  const [mediaSourceVisible, setMediaSourceVisible] = useState(false);
  const [mediaLibraryVisible, setMediaLibraryVisible] = useState(false);
  const isMountedRef = useRef(true);
  const focusRevisionRef = useRef(0);
  const [fieldFocusRequest, setFieldFocusRequest] = useState<FieldFocusRequest | null>(null);
  const {
    clearErrors,
    formState: { errors, isDirty, touchedFields, validatingFields },
    getValues,
    register,
    setValue,
    trigger,
    watch,
  } = useForm<EditProfileFormValues>({
    defaultValues: {
      bio: userData.bio || "",
      clubName: userData.clubName || "",
      department: userData.department || "",
      description: userData.description || "",
      email: userData.email || "",
      gradeYear: userData.gradeYear || "",
      name: userData.name || "",
      university: userData.university || "",
      username: userData.username || "",
    },
    resolver: zodResolver(editProfileSchema),
  });
  const form = watch();
  const fieldErrors = useMemo(() => mapEditProfileFieldErrors(errors), [errors]);
  const initialUsername = useMemo(
    () => sanitizeUsername(String(userData.username || "")),
    [userData.username],
  );

  useEffect(() => {
    EDIT_PROFILE_FIELDS.forEach((field) => {
      register(field);
    });
  }, [register]);

  useEffect(() => {
    setHideEmail(Boolean(userData.hideEmail));
  }, [userData.hideEmail]);

  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const filteredCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.toLocaleLowerCase("tr").includes(categorySearch.toLocaleLowerCase("tr")) ||
          formatTurkishDisplayText(category)
            .toLocaleLowerCase("tr")
            .includes(categorySearch.toLocaleLowerCase("tr")),
      ),
    [categorySearch],
  );
  const displayName = isClub ? form.clubName || "" : form.name || "";
  const about = isClub ? form.description || "" : form.bio || "";
  const initialCategoriesKey = useMemo(
    () => [...(userData.categories ?? [])].sort().join("\u0000"),
    [userData.categories],
  );
  const selectedCategoriesKey = useMemo(
    () => [...selectedCategories].sort().join("\u0000"),
    [selectedCategories],
  );
  const hasUnsavedChanges =
    isDirty ||
    selectedCategoriesKey !== initialCategoriesKey ||
    profileImageUri !== (userData.profileImage ?? "") ||
    coverImageUri !== (userData.coverImage ?? "") ||
    hideEmail !== Boolean(userData.hideEmail);

  const setField = <K extends Path<EditProfileFormValues>>(
    key: K,
    value: PathValue<EditProfileFormValues, K>,
  ) => {
    clearErrors(key);
    setSubmitError("");
    setValue(key, value, { shouldDirty: true, shouldTouch: true });
  };

  const setUsername = (value: string) => {
    setField("username", sanitizeUsername(value));
  };

  const requestFieldFocus = useCallback((fieldName: EditProfileFieldName | "categories") => {
    focusRevisionRef.current += 1;
    setFieldFocusRequest({ fieldName: String(fieldName), revision: focusRevisionRef.current });
  }, []);

  const toggleCategory = (category: string) => {
    setSelectedCategories((previous) => {
      if (previous.includes(category)) {
        setSubmitError("");
        return previous.filter((item) => item !== category);
      }
      if (previous.length >= TEXT_LIMITS.category.maxSelections) {
        setSubmitError(`En fazla ${TEXT_LIMITS.category.maxSelections} kategori secebilirsin.`);
        return previous;
      }
      setSubmitError("");
      return [...previous, category];
    });
  };

  const setPickedImage = (type: "profile" | "cover", uri: string) => {
    if (type === "profile") {
      setProfileImageUri(uri);
      return;
    }
    setCoverImageUri(uri);
  };

  const pickImage = (type: "profile" | "cover") => {
    setMediaTarget(type);
    setMediaSourceVisible(true);
  };

  const closeMediaSourcePicker = () => setMediaSourceVisible(false);
  const closeMediaLibraryPicker = () => setMediaLibraryVisible(false);

  const handleMediaSourceAction = async (action: "camera-photo" | "camera-video" | "library") => {
    setMediaSourceVisible(false);
    await waitForMediaPickerTransition();
    if (action === "library") {
      setMediaLibraryVisible(true);
      return;
    }
    if (action !== "camera-photo") return;
    try {
      const selection = await captureCameraImageSelection({ quality: 0.85 });
      if (selection?.uri) setPickedImage(mediaTarget, selection.uri);
    } catch {
      setSubmitError("Görsel seçmek için izin gerekli.");
    }
  };

  const handleMediaLibrarySelection = (items: MediaSelection[]) => {
    const first = items[0];
    if (!first?.uri) return;
    setPickedImage(mediaTarget, first.uri);
    setMediaLibraryVisible(false);
  };

  return {
    about,
    categorySearch,
    closeMediaLibraryPicker,
    closeMediaSourcePicker,
    coverImageUri,
    displayName,
    errors,
    fieldErrors,
    fieldFocusRequest,
    filteredCategories,
    form,
    getValues,
    hideEmail,
    handleMediaLibrarySelection,
    handleMediaSourceAction,
    hasUnsavedChanges,
    initialUsername,
    isMountedRef,
    mediaLibraryVisible,
    mediaSourceVisible,
    mediaTarget,
    pickImage,
    profileImageUri,
    selectedCategories,
    setCategorySearch,
    setField,
    setSubmitAttempted,
    setSubmitError,
    setUploadProgress,
    setUsername,
    requestFieldFocus,
    submitError,
    submitAttempted,
    toggleCategory,
    touchedFields,
    trigger,
    uploadProgress,
    validatingFields,
  };
}

import { GraduationCap } from "lucide-react-native";
import { Text, View } from "react-native";

import { categories } from "../../../../shared/catalog/taxonomy";
import { CategorySelector, GradientButton } from "../../../../shared/components";
import { TEXT_LIMITS } from "../../../../shared/validation/textLimits";
import {
  RegistrationSelectionBadge,
  RegistrationSubmitError,
  RegistrationUploadProgressCard,
} from "../components";
import type { ClubRegistrationStepProps } from "../clubRegistrationSections.shared";

export function ClubRegistrationCategoriesStep({
  selectedCategories,
  setSelectedCategories,
  submit,
  submitError,
  submitting,
  uploadProgress,
}: ClubRegistrationStepProps) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <GraduationCap size={18} color="#7c3aed" strokeWidth={1.5} />
        <Text style={{ color: "#0f172a", fontSize: 20, fontWeight: "700" }}>
          Kulup Kategorileri
        </Text>
      </View>
      <Text style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
        Kulübünüzün kategorilerini seçin
      </Text>

      <CategorySelector
        errorText={selectedCategories.length === 0 ? submitError : undefined}
        fieldName="categories"
        label="Kategoriler"
        selected={selectedCategories}
        options={categories}
        onChange={setSelectedCategories}
        accent="#7c3aed"
        maxSelections={TEXT_LIMITS.category.maxSelections}
        searchPlaceholder="Kategori ara..."
      />
      <RegistrationSelectionBadge
        accent="#8b5cf6"
        backgroundColor="#f5f3ff"
        textColor="#6d28d9"
        label={`${selectedCategories.length} kategori seçildi`}
      />
      <RegistrationUploadProgressCard
        accent="#7c3aed"
        backgroundColor="#f5f3ff"
        textColor="#6d28d9"
        message={uploadProgress}
      />
      <RegistrationSubmitError message={selectedCategories.length === 0 ? "" : submitError} />

      <View style={{ marginTop: 20 }}>
        <GradientButton
          label="Kayıt Ol"
          onPress={() => void submit()}
          disabled={selectedCategories.length === 0 || submitting}
          loading={submitting}
          variant="primary"
        />
      </View>
    </>
  );
}

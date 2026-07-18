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
import type { StudentRegistrationStepProps } from "../studentRegistrationSections.shared";

export function StudentRegistrationCategoriesStep({
  selectedCategories,
  setSelectedCategories,
  submit,
  submitError,
  submitting,
  uploadProgress,
}: StudentRegistrationStepProps) {
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
        <GraduationCap size={18} color="#2563eb" strokeWidth={1.5} />
        <Text style={{ color: "#0f172a", fontSize: 20, fontWeight: "700" }}>İlgi Alanları</Text>
      </View>
      <Text style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>
        İlgilendiğin konuları seç
      </Text>

      <CategorySelector
        errorText={selectedCategories.length === 0 ? submitError : undefined}
        fieldName="categories"
        label="Kategoriler"
        selected={selectedCategories}
        options={categories}
        onChange={setSelectedCategories}
        accent="#2563eb"
        maxSelections={TEXT_LIMITS.category.maxSelections}
        searchPlaceholder="İlgi alanı ara..."
      />
      <RegistrationSelectionBadge
        accent="#3b82f6"
        backgroundColor="#eff6ff"
        textColor="#1d4ed8"
        label={`${selectedCategories.length} kategori seçildi`}
      />
      <RegistrationUploadProgressCard
        accent="#2563eb"
        backgroundColor="#eff6ff"
        textColor="#1d4ed8"
        message={uploadProgress}
      />
      <RegistrationSubmitError message={selectedCategories.length === 0 ? "" : submitError} />

      <View style={{ marginTop: 20 }}>
        <GradientButton
          label="Kayıt Ol"
          onPress={() => void submit()}
          disabled={selectedCategories.length === 0 || submitting}
          loading={submitting}
        />
      </View>
    </>
  );
}

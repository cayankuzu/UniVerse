import { TextField } from "../../../../shared/components";
import { useTranslation } from "../../../../shared/i18n";
import { SelectField } from "../../../../shared/components/SelectField";
import { LEVEL_OPTIONS, type CreateEventFormState } from "../../domain";
import { EventFormSection } from "./EventFormSection";

interface Props {
  fieldErrors: Partial<Record<keyof CreateEventFormState, string | undefined>>;
  form: CreateEventFormState;
  onSetField: (key: keyof CreateEventFormState, value: string) => void;
}

export function CreateEventStepDetails({ fieldErrors, form, onSetField }: Props) {
  const { t } = useTranslation();

  return (
    <EventFormSection
      title={t("events.create.details.title")}
      subtitle={t("events.create.details.subtitle")}
    >
      <TextField
        errorText={fieldErrors.capacity}
        fieldName="capacity"
        label={t("events.create.details.capacityField")}
        placeholder="100"
        value={form.capacity}
        onChangeText={(value) => onSetField("capacity", value)}
        keyboardType="numeric"
      />

      <TextField
        errorText={fieldErrors.targetAudience}
        fieldName="targetAudience"
        label={t("events.create.details.targetAudienceField")}
        placeholder={t("events.create.details.targetAudiencePlaceholder")}
        value={form.targetAudience}
        onChangeText={(value) => onSetField("targetAudience", value)}
      />

      <SelectField
        errorText={fieldErrors.level}
        fieldName="level"
        label={t("events.create.details.levelField")}
        value={form.level}
        placeholder={t("events.create.details.levelPlaceholder")}
        options={[...LEVEL_OPTIONS]}
        onSelect={(value) => onSetField("level", value)}
      />

      <TextField
        errorText={fieldErrors.materials}
        fieldName="materials"
        label={t("events.create.details.materialsField")}
        placeholder={t("events.create.details.materialsPlaceholder")}
        value={form.materials}
        onChangeText={(value) => onSetField("materials", value)}
      />
    </EventFormSection>
  );
}

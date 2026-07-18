import type { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, View } from "react-native";
import { TextField } from "../../../../shared/components";
import { useTranslation } from "../../../../shared/i18n";
import { SelectField } from "../../../../shared/components/SelectField";
import {
  applyPickerField,
  displayDate,
  displayTime,
  resolvePickerState,
  type PickerField,
} from "../createEventStepSchedule.shared";
import { ACCESS_OPTIONS, type CreateEventFormState } from "../../domain";
import { EventFormSection } from "./EventFormSection";
import { CreateEventSchedulePicker } from "./CreateEventSchedulePicker";
import { CreateEventSchedulePickerField } from "./CreateEventSchedulePickerField";

interface Props {
  fieldErrors: Partial<Record<keyof CreateEventFormState, string | undefined>>;
  form: CreateEventFormState;
  onSetField: (key: keyof CreateEventFormState, value: string) => void;
}

export function CreateEventStepSchedule({ fieldErrors, form, onSetField }: Props) {
  const [activePicker, setActivePicker] = useState<PickerField | null>(null);
  const { t } = useTranslation();
  const { minimumDate, pickerMode, pickerValue } = useMemo(
    () => resolvePickerState(activePicker, form),
    [activePicker, form],
  );

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (!activePicker) return;
    if (Platform.OS === "android") {
      setActivePicker(null);
    }
    if (event.type === "dismissed" || !selectedDate) return;
    applyPickerField({
      field: activePicker,
      form,
      onSetField,
      selectedDate,
    });
  };

  return (
    <EventFormSection
      title={t("events.create.schedule.title")}
      subtitle={t("events.create.schedule.subtitle")}
    >
      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <CreateEventSchedulePickerField
            errorText={fieldErrors.startDate}
            fieldName="startDate"
            label={t("events.create.schedule.startDate")}
            value={displayDate(form.startDate)}
            placeholder={t("events.create.schedule.datePlaceholder")}
            icon="date"
            onPress={() => setActivePicker("startDate")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CreateEventSchedulePickerField
            errorText={fieldErrors.endDate}
            fieldName="endDate"
            label={t("events.create.schedule.endDate")}
            value={displayDate(form.endDate)}
            placeholder={t("events.create.schedule.datePlaceholder")}
            icon="date"
            onPress={() => setActivePicker("endDate")}
          />
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <CreateEventSchedulePickerField
            errorText={fieldErrors.startTime}
            fieldName="startTime"
            label={t("events.create.schedule.startTime")}
            value={displayTime(form.startTime)}
            placeholder={t("events.create.schedule.timePlaceholder")}
            icon="time"
            onPress={() => setActivePicker("startTime")}
          />
        </View>
        <View style={{ flex: 1 }}>
          <CreateEventSchedulePickerField
            errorText={fieldErrors.endTime}
            fieldName="endTime"
            label={t("events.create.schedule.endTime")}
            value={displayTime(form.endTime)}
            placeholder={t("events.create.schedule.timePlaceholder")}
            icon="time"
            onPress={() => setActivePicker("endTime")}
          />
        </View>
      </View>

      <TextField
        errorText={fieldErrors.location}
        fieldName="location"
        label={t("events.create.schedule.locationField")}
        placeholder={t("events.create.schedule.locationPlaceholder")}
        value={form.location}
        onChangeText={(value) => onSetField("location", value)}
      />

      <TextField
        errorText={fieldErrors.address}
        fieldName="address"
        label={t("events.create.schedule.addressField")}
        placeholder={t("events.create.schedule.addressPlaceholder")}
        value={form.address}
        onChangeText={(value) => onSetField("address", value)}
      />

      <SelectField
        errorText={fieldErrors.access}
        fieldName="access"
        label={t("events.create.schedule.accessField")}
        value={form.access}
        placeholder={t("events.create.schedule.accessPlaceholder")}
        options={[...ACCESS_OPTIONS]}
        onSelect={(value) => onSetField("access", value)}
      />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1 }}>
          <SelectField
            errorText={fieldErrors.fee}
            fieldName="fee"
            label={t("events.create.schedule.feeField")}
            value={form.fee}
            placeholder={t("events.create.schedule.feePlaceholder")}
            options={[t("events.create.schedule.feeFree"), t("events.create.schedule.feePaid")]}
            onSelect={(value) => onSetField("fee", value)}
          />
        </View>
        {form.fee === t("events.create.schedule.feePaid") ? (
          <View style={{ flex: 1 }}>
            <TextField
              errorText={fieldErrors.feeAmount}
              fieldName="feeAmount"
              label={t("events.create.schedule.feeAmountField")}
              placeholder="0"
              value={form.feeAmount}
              onChangeText={(value) => onSetField("feeAmount", value)}
              keyboardType="numeric"
            />
          </View>
        ) : (
          <View style={{ flex: 1 }} />
        )}
      </View>

      <CreateEventSchedulePicker
        active={Boolean(activePicker)}
        minimumDate={minimumDate}
        mode={pickerMode}
        onChange={handlePickerChange}
        onClose={() => setActivePicker(null)}
        value={pickerValue}
      />
    </EventFormSection>
  );
}

import React from "react";
import type { StyleProp, TextInputProps, ViewStyle } from "react-native";
import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { TextField, type FieldStatus } from "./TextField";

interface AppTextFieldProps<T extends FieldValues> {
  accessibilityHint?: string;
  autoCapitalize?: TextInputProps["autoCapitalize"];
  autoComplete?: TextInputProps["autoComplete"];
  checkingText?: string;
  containerStyle?: StyleProp<ViewStyle>;
  control: Control<T>;
  errorText?: string;
  fieldName?: string;
  helperText?: string;
  isChecking?: boolean;
  keyboardType?: TextInputProps["keyboardType"];
  label: string;
  multiline?: boolean;
  nextFieldName?: string;
  onBlur?: TextInputProps["onBlur"];
  onFocus?: TextInputProps["onFocus"];
  name: Path<T>;
  onSubmitEditing?: TextInputProps["onSubmitEditing"];
  placeholder?: string;
  returnKeyType?: TextInputProps["returnKeyType"];
  secureTextEntry?: boolean;
  status?: FieldStatus;
  successText?: string;
  supportingText?: string;
  testID?: string;
  textContentType?: TextInputProps["textContentType"];
  validText?: string;
}

export function AppTextField<T extends FieldValues>({
  accessibilityHint,
  autoCapitalize,
  autoComplete,
  checkingText,
  containerStyle,
  control,
  errorText,
  fieldName,
  helperText,
  isChecking,
  keyboardType,
  label,
  multiline,
  nextFieldName,
  onBlur: onBlurProp,
  onFocus: onFocusProp,
  name,
  onSubmitEditing,
  placeholder,
  returnKeyType,
  secureTextEntry,
  status,
  successText,
  supportingText,
  testID,
  textContentType,
  validText,
}: AppTextFieldProps<T>) {
  return (
    <Controller
      control={control}
      name={name}
      render={({
        field: { onBlur: fieldOnBlur, onChange, ref, value },
        fieldState: { error, isTouched },
      }) => (
        <TextField
          accessibilityHint={accessibilityHint}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          checkingText={checkingText}
          containerStyle={containerStyle}
          error={error?.message}
          errorText={errorText}
          fieldName={fieldName ?? String(name)}
          helperText={helperText}
          isChecking={isChecking}
          keyboardType={keyboardType}
          label={label}
          multiline={multiline}
          nextFieldName={nextFieldName}
          onBlur={(event) => {
            fieldOnBlur();
            onBlurProp?.(event);
          }}
          onChangeText={onChange}
          onFocus={onFocusProp}
          onSubmitEditing={onSubmitEditing}
          placeholder={placeholder}
          ref={ref}
          returnKeyType={returnKeyType}
          secureTextEntry={secureTextEntry}
          status={errorText || error ? "invalid" : (status ?? (isTouched ? "idle" : undefined))}
          successText={successText}
          supportingText={supportingText}
          testID={testID}
          textContentType={textContentType}
          validText={validText}
          value={String(value ?? "")}
        />
      )}
    />
  );
}

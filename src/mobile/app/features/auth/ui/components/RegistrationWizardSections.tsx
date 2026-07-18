import type { ReactNode } from "react";
import { CheckCircle2, Circle, GraduationCap, XCircle } from "lucide-react-native";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BackHeader, KeyboardSafeForm, TextField } from "../../../../shared/components";
import type { KeyboardSafeFormFocusRequest } from "../../../../shared/components";
import {
  getPasswordPolicyIssues,
  PASSWORD_POLICY,
  type PasswordPolicyIssue,
} from "../../../../shared/security/passwordPolicy";
import { AuthBrandFooter } from "./AuthBrandFooter";
import { AuthStepProgress } from "./AuthStepProgress";
import { ImagePickerField } from "./ImagePickerField";

type RegistrationScreenLayoutProps = {
  title: string;
  step: number;
  totalSteps: number;
  stepLabels: readonly string[];
  colors: readonly [string, string];
  bottomInset: number;
  focusRequest?: KeyboardSafeFormFocusRequest | null;
  onBack: () => void;
  children: ReactNode;
};

type StepHeadingProps = {
  title: string;
  subtitle: string;
};

type AvailabilityHintProps = {
  active: boolean;
  text: string;
};

type FieldErrorProps = {
  message?: string;
};

type ProfileMediaFieldsProps = {
  accent: string;
  coverImageUri: string | null;
  profileImageUri: string | null;
  coverLabel: string;
  profileLabel: string;
  onPick: (type: "cover" | "profile") => void | Promise<void>;
};

type PasswordFieldsProps = {
  password: string;
  passwordError?: string;
  onPasswordChange: (value: string) => void;
};

type SelectionBadgeProps = {
  accent: string;
  backgroundColor: string;
  textColor: string;
  label: string;
};

type UploadProgressCardProps = {
  accent: string;
  backgroundColor: string;
  textColor: string;
  message?: string;
};

const PASSWORD_RULE_LABELS: Record<PasswordPolicyIssue, string> = {
  digit: "En az 1 rakam",
  lowercase: "En az 1 küçük harf",
  maxLength: `En fazla ${PASSWORD_POLICY.maxLength} karakter`,
  minLength: `En az ${PASSWORD_POLICY.minLength} karakter`,
  uppercase: "En az 1 büyük harf",
};

export function RegistrationScreenLayout({
  bottomInset,
  children,
  colors,
  focusRequest,
  onBack,
  step,
  stepLabels,
  title,
  totalSteps,
}: RegistrationScreenLayoutProps) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#f8fafc" }} edges={["top", "bottom"]}>
      <BackHeader
        title={title}
        right={
          <View style={{ paddingRight: 4 }}>
            <Text style={{ color: "#64748b", fontSize: 12, fontWeight: "500" }}>
              {step}/{totalSteps} - {stepLabels[step - 1]}
            </Text>
          </View>
        }
        onBack={onBack}
      />
      <AuthStepProgress total={totalSteps} current={step} colors={colors} />
      <KeyboardSafeForm
        backgroundColor="#f8fafc"
        bottomInsetOwner="screen"
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: Math.max(bottomInset + 16, 28),
        }}
        focusRequest={focusRequest}
      >
        {children}
        <AuthBrandFooter />
      </KeyboardSafeForm>
    </SafeAreaView>
  );
}

export function RegistrationStepHeading({ subtitle, title }: StepHeadingProps) {
  return (
    <>
      <Text style={{ color: "#0f172a", fontSize: 20, fontWeight: "700", marginBottom: 4 }}>
        {title}
      </Text>
      <Text style={{ color: "#64748b", fontSize: 14, marginBottom: 20 }}>{subtitle}</Text>
    </>
  );
}

export function RegistrationAvailabilityHint({ active, text }: AvailabilityHintProps) {
  if (!active) return null;
  return <Text style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>{text}</Text>;
}

export function RegistrationFieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return <Text style={{ color: "#ef4444", fontSize: 12, marginTop: 4 }}>{message}</Text>;
}

export function RegistrationProfileMediaFields({
  accent,
  coverImageUri,
  coverLabel,
  onPick,
  profileImageUri,
  profileLabel,
}: ProfileMediaFieldsProps) {
  return (
    <>
      <ImagePickerField
        label={coverLabel}
        uri={coverImageUri}
        onPick={() => void onPick("cover")}
        variant="cover"
        accent={accent}
      />
      <ImagePickerField
        label={profileLabel}
        uri={profileImageUri}
        onPick={() => void onPick("profile")}
        variant="avatar"
        accent={accent}
      />
    </>
  );
}

export function RegistrationPasswordField({
  onPasswordChange,
  password,
  passwordError,
}: PasswordFieldsProps) {
  const issues = getPasswordPolicyIssues(password);
  const touched = password.length > 0;
  const isValid = touched && issues.length === 0;

  return (
    <>
      <View style={{ marginTop: 12 }}>
        <TextField
          autoCapitalize="none"
          autoComplete="new-password"
          error={passwordError}
          fieldName="password"
          label="Şifre"
          onChangeText={onPasswordChange}
          status={passwordError ? "invalid" : isValid ? "valid" : "idle"}
          supportingText={`Şifre ${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} karakter olmalı.`}
          secureTextEntry
          validText="Şifre kurala uygun."
          value={password}
        />
      </View>
      <View accessibilityLiveRegion="polite" style={{ gap: 6, marginTop: 8 }}>
        {(Object.keys(PASSWORD_RULE_LABELS) as PasswordPolicyIssue[]).map((rule) => {
          const passed = touched && !issues.includes(rule);
          const failed = touched && !passed;
          const statusText = !touched ? "Henüz kontrol edilmedi" : passed ? "Tamam" : "Eksik";
          return (
            <View
              accessibilityLabel={`${PASSWORD_RULE_LABELS[rule]}: ${statusText}`}
              key={rule}
              style={{ alignItems: "center", flexDirection: "row", gap: 7 }}
            >
              {passed ? (
                <CheckCircle2
                  accessibilityElementsHidden
                  color="#047857"
                  importantForAccessibility="no"
                  size={14}
                  strokeWidth={1.8}
                />
              ) : failed ? (
                <XCircle
                  accessibilityElementsHidden
                  color="#64748b"
                  importantForAccessibility="no"
                  size={14}
                  strokeWidth={1.8}
                />
              ) : (
                <Circle
                  accessibilityElementsHidden
                  color="#64748b"
                  importantForAccessibility="no"
                  size={14}
                  strokeWidth={1.8}
                />
              )}
              <Text style={{ color: passed ? "#047857" : "#64748b", fontSize: 12 }}>
                {PASSWORD_RULE_LABELS[rule]} - {statusText}
              </Text>
            </View>
          );
        })}
      </View>
    </>
  );
}

export function RegistrationSelectionBadge({
  accent,
  backgroundColor,
  label,
  textColor,
}: SelectionBadgeProps) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 12,
        backgroundColor,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 8,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
      <Text style={{ color: textColor, fontSize: 13 }}>{label}</Text>
    </View>
  );
}

export function RegistrationUploadProgressCard({
  accent,
  backgroundColor,
  message,
  textColor,
}: UploadProgressCardProps) {
  if (!message) return null;
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 14,
        backgroundColor,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <GraduationCap size={16} color={accent} strokeWidth={1.5} />
      <Text style={{ color: textColor, fontSize: 13 }}>{message}</Text>
    </View>
  );
}

export function RegistrationSubmitError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <View
      style={{
        marginTop: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#fecaca",
        backgroundColor: "#fef2f2",
        paddingHorizontal: 12,
        paddingVertical: 10,
      }}
    >
      <Text style={{ color: "#dc2626", fontSize: 13, fontWeight: "500" }}>{message}</Text>
    </View>
  );
}

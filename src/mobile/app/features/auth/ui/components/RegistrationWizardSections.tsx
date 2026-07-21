import type { ReactNode } from "react";
import { CheckCircle2, Circle, GraduationCap, XCircle } from "lucide-react-native";
import { View } from "react-native";
import { AppText as Text } from "../../../../shared/components/AppText";
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
import { tokens } from "../../../../shared/theme";

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
    <SafeAreaView
      style={{ flex: 1, backgroundColor: tokens.colors.background }}
      edges={["top", "bottom"]}
    >
      <BackHeader
        title={title}
        right={
          <View style={{ paddingRight: tokens.spacing.xxs }}>
            <Text
              style={{
                color: tokens.colors.muted,
                fontSize: tokens.typography.caption,
                fontWeight: "500",
              }}
            >
              {step}/{totalSteps} - {stepLabels[step - 1]}
            </Text>
          </View>
        }
        onBack={onBack}
      />
      <AuthStepProgress total={totalSteps} current={step} colors={colors} />
      <KeyboardSafeForm
        backgroundColor={tokens.colors.background}
        bottomInsetOwner="screen"
        contentContainerStyle={{
          paddingHorizontal: tokens.spacing.xl,
          paddingTop: tokens.spacing.md,
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
      <Text
        style={{
          color: tokens.colors.foreground,
          fontSize: tokens.typography.sectionTitle,
          fontWeight: "700",
          marginBottom: tokens.spacing.xxs,
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          color: tokens.colors.muted,
          fontSize: tokens.typography.body,
          marginBottom: tokens.spacing.lg,
        }}
      >
        {subtitle}
      </Text>
    </>
  );
}

export function RegistrationAvailabilityHint({ active, text }: AvailabilityHintProps) {
  if (!active) return null;
  return (
    <Text
      style={{
        color: tokens.colors.muted,
        fontSize: tokens.typography.caption,
        marginTop: tokens.spacing.xxs,
      }}
    >
      {text}
    </Text>
  );
}

export function RegistrationFieldError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <Text
      style={{
        color: tokens.colors.red,
        fontSize: tokens.typography.caption,
        marginTop: tokens.spacing.xxs,
      }}
    >
      {message}
    </Text>
  );
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
      <View style={{ marginTop: tokens.spacing.sm }}>
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
      <View
        accessibilityLiveRegion="polite"
        style={{ gap: tokens.spacing.xsMinus, marginTop: tokens.spacing.xs }}
      >
        {(Object.keys(PASSWORD_RULE_LABELS) as PasswordPolicyIssue[]).map((rule) => {
          const passed = touched && !issues.includes(rule);
          const failed = touched && !passed;
          const statusText = !touched ? "Henüz kontrol edilmedi" : passed ? "Tamam" : "Eksik";
          return (
            <View
              accessibilityLabel={`${PASSWORD_RULE_LABELS[rule]}: ${statusText}`}
              key={rule}
              style={{ alignItems: "center", flexDirection: "row", gap: tokens.spacing.xsCompact }}
            >
              {passed ? (
                <CheckCircle2
                  accessibilityElementsHidden
                  color={tokens.colors.successText}
                  importantForAccessibility="no"
                  size={14}
                  strokeWidth={1.8}
                />
              ) : failed ? (
                <XCircle
                  accessibilityElementsHidden
                  color={tokens.colors.muted}
                  importantForAccessibility="no"
                  size={14}
                  strokeWidth={1.8}
                />
              ) : (
                <Circle
                  accessibilityElementsHidden
                  color={tokens.colors.muted}
                  importantForAccessibility="no"
                  size={14}
                  strokeWidth={1.8}
                />
              )}
              <Text
                style={{
                  color: passed ? tokens.colors.successText : tokens.colors.muted,
                  fontSize: tokens.typography.caption,
                }}
              >
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
        gap: tokens.spacing.xs,
        marginTop: tokens.spacing.sm,
        backgroundColor,
        borderRadius: tokens.radius.compact,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.xs,
      }}
    >
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: accent }} />
      <Text style={{ color: textColor, fontSize: tokens.typography.label }}>{label}</Text>
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
        gap: tokens.spacing.xs,
        marginTop: tokens.spacing.smPlus,
        backgroundColor,
        borderRadius: tokens.radius.compact,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.compact,
      }}
    >
      <GraduationCap size={16} color={accent} strokeWidth={1.5} />
      <Text style={{ color: textColor, fontSize: tokens.typography.label }}>{message}</Text>
    </View>
  );
}

export function RegistrationSubmitError({ message }: FieldErrorProps) {
  if (!message) return null;
  return (
    <View
      style={{
        marginTop: tokens.spacing.sm,
        borderRadius: tokens.radius.md,
        borderWidth: 1,
        borderColor: tokens.colors.dangerBorder,
        backgroundColor: tokens.colors.dangerSoft,
        paddingHorizontal: tokens.spacing.sm,
        paddingVertical: tokens.spacing.compact,
      }}
    >
      <Text
        style={{
          color: tokens.colors.danger,
          fontSize: tokens.typography.label,
          fontWeight: "500",
        }}
      >
        {message}
      </Text>
    </View>
  );
}

import {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import {
  ActivityIndicator,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type TextInput as NativeTextInput,
  type ViewStyle,
} from "react-native";
import { CheckCircle2, Eye, EyeOff, XCircle } from "lucide-react-native";
import {
  HelperText,
  TextInput,
  type TextInputProps as PaperTextInputProps,
} from "react-native-paper";
import { tokens } from "../../shared/theme";
import { useKeyboardSafeField, useKeyboardSafeFormActions } from "./KeyboardSafeForm";

export type FieldStatus = "idle" | "focused" | "validating" | "valid" | "invalid" | "disabled";

type Props = Omit<PaperTextInputProps, "error" | "mode" | "right" | "theme"> & {
  checkingText?: string;
  containerOnLayout?: (event: LayoutChangeEvent) => void;
  containerStyle?: StyleProp<ViewStyle>;
  disabled?: boolean;
  error?: string;
  errorText?: string;
  fieldName?: string;
  helperText?: string;
  isChecking?: boolean;
  nextFieldName?: string;
  required?: boolean;
  status?: FieldStatus;
  supportingText?: string;
  rightIcon?: ReactNode;
  successText?: string;
  validText?: string;
};

export const TextField = forwardRef<NativeTextInput, Props>(
  (
    {
      containerStyle,
      containerOnLayout,
      disabled,
      editable,
      error,
      errorText,
      fieldName,
      helperText,
      isChecking,
      label,
      nextFieldName,
      onBlur,
      onFocus,
      onSubmitEditing,
      required,
      rightIcon,
      secureTextEntry,
      status,
      style,
      supportingText,
      successText,
      validText,
      checkingText = "Kontrol ediliyor...",
      ...rest
    },
    ref,
  ) => {
    const inputRef = useRef<NativeTextInput | null>(null);
    const keyboardField = useKeyboardSafeField(fieldName);
    const keyboardActions = useKeyboardSafeFormActions();
    const [hidden, setHidden] = useState(secureTextEntry);
    const [focused, setFocused] = useState(false);
    const isMultiline = Boolean(rest.multiline);
    const resolvedError = errorText || error;
    const resolvedSupportingText = helperText ?? supportingText;
    const resolvedValidText = successText ?? validText;
    const resolvedStatus: FieldStatus =
      disabled || editable === false
        ? "disabled"
        : resolvedError
          ? "invalid"
          : isChecking
            ? "validating"
            : status === "idle" && focused
              ? "focused"
              : (status ?? (focused ? "focused" : "idle"));
    const isInvalid = resolvedStatus === "invalid";
    const helperMessage =
      resolvedError ||
      (resolvedStatus === "validating" ? checkingText : undefined) ||
      (resolvedStatus === "valid" ? resolvedValidText : undefined) ||
      resolvedSupportingText ||
      "";
    const outlineColor = useMemo(() => {
      if (isInvalid) return tokens.colors.danger;
      if (resolvedStatus === "valid") return tokens.colors.successText;
      if (resolvedStatus === "validating" || resolvedStatus === "focused") {
        return tokens.colors.primary;
      }
      if (resolvedStatus === "disabled") return tokens.colors.borderLight;
      return tokens.colors.border;
    }, [isInvalid, resolvedStatus]);
    const backgroundColor = tokens.colors.surface;
    const textColor = tokens.colors.foreground;
    const placeholderColor = tokens.colors.mutedFg;
    const iconColor = tokens.colors.iconMuted;
    const helperColor = isInvalid
      ? tokens.colors.danger
      : resolvedStatus === "valid"
        ? tokens.colors.successText
        : tokens.colors.mutedFg;
    const resolvedLabel = required && typeof label === "string" ? `${label} *` : label;
    const statusIcon = useMemo((): ReactElement | undefined => {
      if (resolvedStatus === "validating") {
        return <ActivityIndicator color={tokens.colors.primary} size="small" />;
      }
      if (resolvedStatus === "valid") {
        return <CheckCircle2 size={18} color={tokens.colors.successText} />;
      }
      if (isInvalid) {
        return <XCircle size={18} color={tokens.colors.danger} />;
      }
      return undefined;
    }, [isInvalid, resolvedStatus]);
    const trailingIcon = statusIcon || rightIcon;
    const isEditable = !disabled && editable !== false;
    const setInputRef = useCallback(
      (node: NativeTextInput | null) => {
        inputRef.current = node;
        if (typeof ref === "function") {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      },
      [ref],
    );
    const handleContainerLayout = useCallback(
      (event: LayoutChangeEvent) => {
        keyboardField.onLayout(event);
        containerOnLayout?.(event);
      },
      [containerOnLayout, keyboardField],
    );

    useEffect(() => {
      if (!fieldName) return undefined;
      return keyboardActions?.registerFieldFocus(
        fieldName,
        () => inputRef.current?.focus(),
        inputRef.current,
      );
    }, [fieldName, keyboardActions]);

    return (
      <View
        ref={keyboardField.ref}
        collapsable={false}
        onLayout={handleContainerLayout}
        style={[{ gap: 4 }, containerStyle]}
      >
        <TextInput
          {...rest}
          ref={setInputRef}
          accessibilityHint={rest.accessibilityHint ?? (helperMessage ? helperMessage : undefined)}
          accessibilityLabel={
            rest.accessibilityLabel ??
            (typeof resolvedLabel === "string" ? resolvedLabel : undefined)
          }
          accessibilityState={{
            busy: resolvedStatus === "validating",
            disabled: !isEditable,
          }}
          contentStyle={[
            {
              fontSize: 15,
              minHeight: isMultiline ? 108 : 50,
              color: textColor,
              textAlignVertical: isMultiline ? "top" : "center",
            },
            style,
          ]}
          disabled={!isEditable}
          editable={isEditable}
          label={resolvedLabel}
          mode="outlined"
          outlineStyle={{ borderRadius: 14 }}
          placeholderTextColor={placeholderColor}
          onBlur={(event) => {
            setFocused(false);
            onBlur?.(event);
          }}
          onFocus={(event) => {
            setFocused(true);
            keyboardField.onFocus();
            onFocus?.(event);
          }}
          onSubmitEditing={(event) => {
            if (nextFieldName && keyboardActions?.focusField(nextFieldName)) {
              return;
            }
            onSubmitEditing?.(event);
          }}
          right={
            secureTextEntry ? (
              <TextInput.Icon
                accessibilityLabel={hidden ? "Şifreyi göster" : "Şifreyi gizle"}
                accessibilityRole="button"
                color={iconColor}
                forceTextInputFocus={false}
                icon={() =>
                  hidden ? (
                    <EyeOff size={18} color={iconColor} />
                  ) : (
                    <Eye size={18} color={iconColor} />
                  )
                }
                onPress={() => setHidden((value) => !value)}
              />
            ) : trailingIcon ? (
              <TextInput.Icon
                color={iconColor}
                disabled
                forceTextInputFocus={false}
                icon={() => trailingIcon}
              />
            ) : undefined
          }
          secureTextEntry={Boolean(secureTextEntry && hidden)}
          style={{ backgroundColor }}
          textColor={textColor}
          theme={{
            colors: {
              background: backgroundColor,
              error: tokens.colors.danger,
              onSurface: textColor,
              onSurfaceVariant: placeholderColor,
              outline: outlineColor,
              primary: tokens.colors.primary,
            },
          }}
        />
        <HelperText
          accessibilityLiveRegion={
            isInvalid || resolvedStatus === "validating" ? "polite" : undefined
          }
          padding="none"
          style={{ color: helperColor, lineHeight: 18, minHeight: 18 }}
          type={isInvalid ? "error" : "info"}
          visible
        >
          {helperMessage}
        </HelperText>
      </View>
    );
  },
);

TextField.displayName = "TextField";

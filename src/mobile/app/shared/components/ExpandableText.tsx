import { useState } from "react";
import { AppText as Text } from "./AppText";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Pressable, View } from "react-native";
import { tokens } from "../../shared/theme";

export type ExpandableTextProps = {
  collapsedLabel?: string;
  collapsedLines?: number;
  containerStyle?: StyleProp<ViewStyle>;
  expandedLabel?: string;
  minExpandableChars?: number;
  text: string;
  textStyle?: StyleProp<TextStyle>;
  toggleTextStyle?: StyleProp<TextStyle>;
};

export function ExpandableText({
  collapsedLabel = "... >",
  collapsedLines = 2,
  containerStyle,
  expandedLabel = "Daralt v",
  minExpandableChars = 100,
  text,
  textStyle,
  toggleTextStyle,
}: ExpandableTextProps) {
  const [expanded, setExpanded] = useState(false);
  const normalizedText = String(text || "").trim();

  if (!normalizedText) return null;

  const lineCount = normalizedText.split(/\r?\n/).length;
  const canExpand = normalizedText.length > minExpandableChars || lineCount > collapsedLines;
  const toggle = () => {
    if (canExpand) setExpanded((current) => !current);
  };

  return (
    <View style={containerStyle}>
      <Text
        ellipsizeMode="tail"
        numberOfLines={!canExpand || expanded ? undefined : collapsedLines}
        onPress={toggle}
        style={textStyle}
      >
        {normalizedText}
      </Text>
      {canExpand ? (
        <Pressable
          accessibilityRole="button"
          onPress={toggle}
          style={{ alignSelf: "flex-start", marginTop: tokens.spacing.xxs }}
        >
          <Text style={toggleTextStyle}>{expanded ? expandedLabel : collapsedLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

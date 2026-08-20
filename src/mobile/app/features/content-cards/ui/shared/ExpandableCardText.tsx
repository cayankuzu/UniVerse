import { useState } from "react";
import { AppText as Text } from "../../../../shared/components/AppText";
import type { StyleProp, TextStyle, ViewStyle } from "react-native";
import { Pressable, View } from "react-native";
import { tokens } from "../../../../shared/theme";

type Props = {
  collapsedLabel?: string;
  collapsedLines?: number;
  containerStyle?: StyleProp<ViewStyle>;
  expandedLabel?: string;
  minExpandableChars?: number;
  text: string;
  textStyle?: StyleProp<TextStyle>;
  toggleTextStyle?: StyleProp<TextStyle>;
};

export function ExpandableCardText({
  collapsedLabel = "... >",
  collapsedLines = 2,
  containerStyle,
  expandedLabel = "Daralt v",
  minExpandableChars = 100,
  text,
  textStyle,
  toggleTextStyle,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const normalizedText = String(text || "").trim();

  if (!normalizedText) return null;

  const canExpand = normalizedText.length > minExpandableChars;

  return (
    <View style={containerStyle}>
      <Text
        ellipsizeMode="tail"
        numberOfLines={!canExpand || expanded ? undefined : collapsedLines}
        style={textStyle}
      >
        {normalizedText}
      </Text>
      {canExpand ? (
        <Pressable
          onPress={() => setExpanded((current) => !current)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? expandedLabel : collapsedLabel}
          accessibilityState={{ expanded }}
          style={{ alignSelf: "flex-start", marginTop: tokens.spacing.xxs }}
        >
          <Text style={toggleTextStyle}>{expanded ? expandedLabel : collapsedLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

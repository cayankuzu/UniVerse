import React from "react";
import { Image, StyleSheet, View } from "react-native";
import { tokens } from "../../shared/theme";

const splashImage = require("../../../../../assets/splash/brand-screen.png");

export function StartupSplashScreen() {
  return (
    <View pointerEvents="none" style={styles.container} testID="startup-splash-overlay">
      <Image source={splashImage} style={styles.image} resizeMode="cover" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: tokens.colors.onMedia,
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

import React from "react";
import { Image, StyleSheet, View } from "react-native";

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
    backgroundColor: "#FFFFFF",
  },
  image: {
    width: "100%",
    height: "100%",
  },
});

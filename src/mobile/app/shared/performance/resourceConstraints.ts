let lowPowerModeEnabled = false;

export function isLowPowerModeEnabled() {
  return lowPowerModeEnabled;
}

export function setLowPowerModeEnabled(enabled: boolean) {
  lowPowerModeEnabled = Boolean(enabled);
}

export function resetResourceConstraintsForTests() {
  lowPowerModeEnabled = false;
}

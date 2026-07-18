import { useEffect } from "react";
import { hydrateLocale } from "./index";

export function I18nBootstrap() {
  useEffect(() => {
    void hydrateLocale();
  }, []);

  return null;
}

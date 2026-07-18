import AsyncStorage from "@react-native-async-storage/async-storage";
import { hydrateLocale, persistLocale } from "./index";

describe("locale bootstrap", () => {
  it("does not spend startup storage IO when only one locale is bundled", async () => {
    const getItemSpy = jest.spyOn(AsyncStorage, "getItem");
    const setItemSpy = jest.spyOn(AsyncStorage, "setItem");

    await expect(hydrateLocale()).resolves.toBe("tr");
    await expect(persistLocale("tr")).resolves.toBe("tr");

    expect(getItemSpy).not.toHaveBeenCalled();
    expect(setItemSpy).not.toHaveBeenCalled();
  });
});

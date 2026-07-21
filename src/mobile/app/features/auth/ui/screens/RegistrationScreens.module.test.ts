import { ClubRegisterScreen } from "./ClubRegisterScreen";
import { StudentRegisterScreen } from "./StudentRegisterScreen";

describe("registration screen modules", () => {
  it("exposes both account-specific registration flows", () => {
    expect(ClubRegisterScreen).toEqual(expect.any(Function));
    expect(StudentRegisterScreen).toEqual(expect.any(Function));
  });
});

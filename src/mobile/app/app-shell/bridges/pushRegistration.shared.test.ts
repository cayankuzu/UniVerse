describe("pushRegistration.shared", () => {
  it("registers the foreground notification presentation handler at startup", () => {
    const notificationsModule = jest.requireMock("expo-notifications") as {
      setNotificationHandler: jest.Mock;
    };

    notificationsModule.setNotificationHandler.mockClear();

    jest.isolateModules(() => {
      require("./pushRegistration.shared");
    });

    expect(notificationsModule.setNotificationHandler).toHaveBeenCalledWith({
      handleNotification: expect.any(Function),
    });
  });
});

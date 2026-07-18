import { redactString, redactValue, sanitizeEmailForLogs } from "./redaction";

describe("security redaction", () => {
  it("redacts bearer tokens, signed URL secrets, and emails from strings", () => {
    const input =
      "Bearer secret-token https://example.com?a=1&access_token=abc123 and user@example.com";
    const redacted = redactString(input);

    expect(redacted).toContain("Bearer [redacted]");
    expect(redacted).toContain("access_token=[redacted]");
    expect(redacted).toContain("us***@example.com");
  });

  it("redacts sensitive keys inside nested objects", () => {
    expect(
      redactValue({
        authorization: "Bearer abc",
        nested: {
          refresh_token: "xyz",
        },
      }),
    ).toEqual({
      authorization: "[redacted]",
      nested: {
        refresh_token: "[redacted]",
      },
    });
  });

  it("masks emails for logs without exposing the full local-part", () => {
    expect(sanitizeEmailForLogs("person@example.com")).toBe("pe***@example.com");
  });
});

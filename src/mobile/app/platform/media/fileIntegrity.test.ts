let mockFileBytes = new Uint8Array();
let mockDeclaredSize: number | null = null;
let mockReturnEmptyChunk = false;
let mockReturnExtraByte = false;
const mockClose = jest.fn();

jest.mock("expo-file-system", () => ({
  File: class MockFile {
    exists = true;
    size = mockDeclaredSize ?? mockFileBytes.length;

    open() {
      let offset = 0;
      return {
        close: mockClose,
        readBytes: (length: number) => {
          if (mockReturnEmptyChunk) return new Uint8Array();
          if (mockReturnExtraByte) return new Uint8Array(length + 1);
          const bytes = mockFileBytes.slice(offset, offset + length);
          offset += bytes.length;
          return bytes;
        },
      };
    }
  },
}));

import { calculateLocalFileIntegrity } from "./fileIntegrity";

describe("local media integrity", () => {
  beforeEach(() => {
    mockClose.mockClear();
    mockDeclaredSize = null;
    mockReturnEmptyChunk = false;
    mockReturnExtraByte = false;
  });

  it("calculates a streaming SHA-256 and exact byte size", async () => {
    mockFileBytes = Uint8Array.from([97, 98, 99]);

    await expect(calculateLocalFileIntegrity("file:///media.jpg")).resolves.toEqual({
      checksumSha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      sizeBytes: 3,
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("rejects empty files before issuing an upload ticket", async () => {
    mockFileBytes = new Uint8Array();

    await expect(calculateLocalFileIntegrity("file:///empty.jpg")).rejects.toThrow(
      "Medya dosyası okunamadı veya boş.",
    );
  });

  it("yields between large hashing chunks without losing integrity", async () => {
    mockFileBytes = new Uint8Array(4 * 1024 * 1024 + 1).fill(7);

    await expect(calculateLocalFileIntegrity("file:///large.mp4")).resolves.toMatchObject({
      sizeBytes: mockFileBytes.length,
    });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("closes the handle when the native reader stalls", async () => {
    mockFileBytes = Uint8Array.from([1, 2, 3]);
    mockReturnEmptyChunk = true;

    await expect(calculateLocalFileIntegrity("file:///stalled.jpg")).rejects.toThrow(
      "tamamen okunamadı",
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it("rejects a native reader that returns more bytes than declared", async () => {
    mockFileBytes = Uint8Array.from([1, 2, 3]);
    mockDeclaredSize = 3;
    mockReturnExtraByte = true;

    await expect(calculateLocalFileIntegrity("file:///overread.jpg")).rejects.toThrow(
      "boyutu doğrulanamadı",
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});

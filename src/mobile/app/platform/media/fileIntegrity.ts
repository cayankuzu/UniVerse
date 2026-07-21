import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { File } from "expo-file-system";

const FILE_HASH_CHUNK_BYTES = 1024 * 1024;
const FILE_HASH_YIELD_EVERY_CHUNKS = 4;

function yieldToRuntime() {
  return new Promise<void>((resolve) => setTimeout(resolve, 0));
}

export async function calculateLocalFileIntegrity(uri: string) {
  const file = new File(uri);
  if (!file.exists || file.size <= 0) {
    throw new Error("Medya dosyası okunamadı veya boş.");
  }

  const handle = file.open();
  const hash = sha256.create();
  let bytesRead = 0;
  let chunkCount = 0;
  try {
    while (bytesRead < file.size) {
      const chunk = handle.readBytes(Math.min(FILE_HASH_CHUNK_BYTES, file.size - bytesRead));
      if (chunk.length === 0) {
        throw new Error("Medya dosyası tamamen okunamadı.");
      }
      hash.update(chunk);
      bytesRead += chunk.length;
      chunkCount += 1;
      if (chunkCount % FILE_HASH_YIELD_EVERY_CHUNKS === 0) {
        await yieldToRuntime();
      }
    }
  } finally {
    handle.close();
  }

  if (bytesRead !== file.size) {
    throw new Error("Medya dosyası boyutu doğrulanamadı.");
  }
  return {
    checksumSha256: bytesToHex(hash.digest()),
    sizeBytes: bytesRead,
  };
}

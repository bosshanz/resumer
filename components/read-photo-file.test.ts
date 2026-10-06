import { afterEach, describe, expect, it, vi } from "vitest";
import { readPhotoFile } from "./read-photo-file";

function photo(type = "image/png", size = 100): File {
  return { type, size } as File;
}

afterEach(() => vi.unstubAllGlobals());

describe("readPhotoFile", () => {
  it("rejects non-images and images over 2MB before reading", async () => {
    const reader = vi.fn();
    vi.stubGlobal("FileReader", reader);
    await expect(readPhotoFile(photo("text/plain"))).rejects.toThrow("图片文件");
    await expect(readPhotoFile(photo("image/png", 2 * 1024 * 1024 + 1))).rejects.toThrow("2MB");
    expect(reader).not.toHaveBeenCalled();
  });

  it("does not return a file that cannot be decoded as an image", async () => {
    class Reader {
      result = "data:image/png;base64,broken";
      onload?: () => void;
      readAsDataURL() { this.onload?.(); }
    }
    class BrokenImage {
      onerror?: () => void;
      set src(_value: string) { this.onerror?.(); }
    }
    vi.stubGlobal("FileReader", Reader);
    vi.stubGlobal("Image", BrokenImage);
    await expect(readPhotoFile(photo())).rejects.toThrow("无法识别");
  });

  it("reports a read failure without accepting a photo", async () => {
    class FailedReader {
      onerror?: () => void;
      readAsDataURL() { this.onerror?.(); }
    }
    vi.stubGlobal("FileReader", FailedReader);
    await expect(readPhotoFile(photo())).rejects.toThrow("读取失败");
  });

  it("returns the data URL only after successful decoding", async () => {
    class Reader {
      result = "data:image/png;base64,valid";
      onload?: () => void;
      readAsDataURL() { this.onload?.(); }
    }
    class ValidImage {
      naturalWidth = 1;
      naturalHeight = 1;
      onload?: () => void;
      set src(_value: string) { this.onload?.(); }
    }
    vi.stubGlobal("FileReader", Reader);
    vi.stubGlobal("Image", ValidImage);
    await expect(readPhotoFile(photo())).resolves.toBe("data:image/png;base64,valid");
  });
});

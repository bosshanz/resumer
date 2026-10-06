const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

export async function readPhotoFile(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) {
    throw new Error("请选择图片文件，原照片未更改。");
  }
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("照片不能超过 2MB，原照片未更改。");
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("照片读取失败，原照片未更改，请重试。"));
    reader.onabort = () => reject(new Error("照片读取已中断，原照片未更改，请重试。"));
    reader.onload = () => {
      if (typeof reader.result !== "string" || !reader.result.startsWith("data:image/")) {
        reject(new Error("照片读取失败，原照片未更改，请重试。"));
        return;
      }
      resolve(reader.result);
    };
    try {
      reader.readAsDataURL(file);
    } catch {
      reject(new Error("照片读取失败，原照片未更改，请重试。"));
    }
  });

  await new Promise<void>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.naturalWidth && image.naturalHeight) resolve();
      else reject(new Error("无法识别这张照片，原照片未更改。"));
    };
    image.onerror = () => reject(new Error("无法识别这张照片，原照片未更改。"));
    image.src = dataUrl;
  });

  return dataUrl;
}

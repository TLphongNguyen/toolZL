import { Zalo, ThreadType } from "zca-js";
import sizeOf from "image-size";
import fs from "fs";

let zaloApi = null;
let zaloInitialized = false;

export async function initZalo() {
  try {
    const zalo = new Zalo({
      selfListen: false,
      checkUpdate: true,
      logging: false,
      imageMetadataGetter: async (imagePath) => {
        try {
          // Read file as buffer and pass to image-size
          const buffer = fs.readFileSync(imagePath);
          const dimensions = sizeOf(buffer);
          return {
            width: dimensions.width || 1920,
            height: dimensions.height || 1080,
          };
        } catch (error) {
          console.error("Error getting image metadata:", error);
          // Return default dimensions if error
          return { width: 1920, height: 1080 };
        }
      },
    });

    zaloApi = await zalo.loginQR({
      userAgent: "",
      qrPath: "./qr.png",
    });

    zaloApi.listener.start();
    zaloInitialized = true;
  } catch (error) {
    zaloInitialized = false;
    // optional: log error
  }
}

export function getZaloStatus() {
  return {
    initialized: zaloInitialized,
    hasApi: !!zaloApi,
  };
}

export function getZaloApi() {
  return zaloApi;
}

export { ThreadType };


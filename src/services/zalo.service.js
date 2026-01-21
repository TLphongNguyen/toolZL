import { Zalo, ThreadType } from "zca-js";

let zaloApi = null;
let zaloInitialized = false;

export async function initZalo() {
  try {
    const zalo = new Zalo({
      selfListen: false,
      checkUpdate: true,
      logging: false,
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


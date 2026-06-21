import { Capacitor } from "@capacitor/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { binaryToBase64 } from "@/lib/binaryToBase64";

/**
 * Grava o KMZ no armazenamento externo da app (Android) e devolve um URI
 * `content://` para abrir com FileOpener. No browser ou iOS devolve null.
 */
export async function persistKmzForAndroidOpen(
  blob: Blob,
  fileName: string,
): Promise<string | null> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
    return null;
  }
  try {
    const b64 = binaryToBase64(await blob.arrayBuffer());
    const subPath = `kmz_exports/${fileName}`;
    await Filesystem.writeFile({
      path: subPath,
      data: b64,
      directory: Directory.External,
      recursive: true,
    });
    const { uri } = await Filesystem.getUri({
      directory: Directory.External,
      path: subPath,
    });
    return uri;
  } catch {
    return null;
  }
}

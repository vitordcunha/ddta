import { FileOpener } from "@capacitor-community/file-opener";
import { toast } from "sonner";

const KMZ_MIME = "application/vnd.google-earth.kmz";

export async function openAndroidKmzFile(uri: string) {
  try {
    await FileOpener.open({
      filePath: uri,
      contentType: KMZ_MIME,
    });
  } catch {
    toast.error("Não foi possível abrir o ficheiro.");
  }
}

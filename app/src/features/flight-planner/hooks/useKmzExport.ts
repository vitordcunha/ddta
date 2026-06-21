import { useState } from "react";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import {
  generateKmz,
  type KmzVariant,
} from "@/features/flight-planner/utils/kmzBuilder";
import { persistKmzForAndroidOpen } from "@/features/flight-planner/utils/persistKmzForAndroidOpen";
import { openAndroidKmzFile } from "@/lib/openAndroidKmzFile";
import type {
  FlightParams,
  PointOfInterest,
  Waypoint,
} from "@/features/flight-planner/types";

type ExportStatus = "idle" | "generating" | "done" | "error";

export type KmzExportResult = {
  /** URI `content://` no Android nativo quando a gravação local teve sucesso; caso contrário null. */
  androidOpenUri: string | null;
  ok: boolean;
};

export type KmzExportOptions = {
  variant?: KmzVariant;
  poi?: PointOfInterest | null;
  /** Quando false, o chamador mostra o próprio feedback (ex.: toast combinado). Predefinição: true. */
  notify?: boolean;
};

export function useKmzExport(projectName: string) {
  const [status, setStatus] = useState<ExportStatus>("idle");
  const [kmzBlob, setKmzBlob] = useState<Blob | null>(null);

  const generateAndDownload = async (
    waypoints: Waypoint[],
    params: FlightParams,
    options?: KmzExportOptions,
  ): Promise<KmzExportResult> => {
    const notify = options?.notify !== false;
    let androidOpenUri: string | null = null;

    try {
      setStatus("generating");
      const variant = options?.variant;
      const blob = await generateKmz(waypoints, {
        projectName,
        params,
        variant,
        poi: options?.poi,
      });
      setKmzBlob(blob);

      const slug = projectName.replaceAll(/\s+/g, "-").toLowerCase();
      const fileName =
        variant === "calibration"
          ? `${slug}-calibration.kmz`
          : `${slug}-flight-plan.kmz`;

      const isAndroidNative =
        Capacitor.isNativePlatform() && Capacitor.getPlatform() === "android";

      if (isAndroidNative) {
        androidOpenUri = await persistKmzForAndroidOpen(blob, fileName);
      }

      if (!isAndroidNative || !androidOpenUri) {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = fileName;
        anchor.click();
        URL.revokeObjectURL(url);
      }

      setStatus("done");
      if (notify) {
        const openUri = androidOpenUri;
        toast.success(
          variant === "calibration"
            ? "KMZ de calibração guardado."
            : "KMZ da missão guardado.",
          {
            description: fileName,
            ...(openUri
              ? {
                  action: {
                    label: "Abrir",
                    onClick: () => {
                      void openAndroidKmzFile(openUri);
                    },
                  },
                }
              : {}),
          },
        );
      }
      window.setTimeout(() => setStatus("idle"), 1800);
      return { androidOpenUri, ok: true };
    } catch {
      setStatus("error");
      if (notify) {
        toast.error("Não foi possível gerar o KMZ.");
      }
      window.setTimeout(() => setStatus("idle"), 2800);
      return { androidOpenUri: null, ok: false };
    }
  };

  return { status, kmzBlob, generateAndDownload };
}

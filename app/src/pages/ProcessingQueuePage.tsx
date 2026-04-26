import { Navigate } from "react-router-dom";
import { WORKSPACE_ROOT } from "@/constants/routes";

/** Rota legada: a fila vive no workspace para manter o mapa visivel. */
export function ProcessingQueuePage() {
  return <Navigate to={`${WORKSPACE_ROOT}?panel=queue`} replace />;
}

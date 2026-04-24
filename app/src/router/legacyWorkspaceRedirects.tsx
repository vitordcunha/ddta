import { Navigate, useParams } from "react-router-dom"
import type { WorkspacePanelId } from "@/constants/routes"

export function LegacyProjectToWorkspace() {
  const { id = "" } = useParams()
  return <Navigate to={`/?panel=projects&project=${id}`} replace />
}

export function LegacyProjectPanelRedirect({ panel }: { panel: WorkspacePanelId }) {
  const { id = "" } = useParams()
  return <Navigate to={`/?panel=${panel}&project=${id}`} replace />
}

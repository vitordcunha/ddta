import { Navigate, createBrowserRouter } from "react-router-dom"
import { LegacyProjectPanelRedirect, LegacyProjectToWorkspace } from "@/router/legacyWorkspaceRedirects"
import { WORKSPACE_ROOT } from "@/constants/routes"
import { WorkspacePage } from "@/pages/WorkspacePage"

export const router = createBrowserRouter([
  { path: WORKSPACE_ROOT, element: <WorkspacePage /> },
  { path: "/dashboard", element: <Navigate to="/?panel=projects" replace /> },
  { path: "/settings", element: <Navigate to="/?panel=settings" replace /> },
  { path: "/projects/new", element: <Navigate to="/?panel=projects" replace /> },
  { path: "/projects/:id", element: <LegacyProjectToWorkspace /> },
  { path: "/projects/:id/plan", element: <LegacyProjectPanelRedirect panel="plan" /> },
  { path: "/projects/:id/upload", element: <LegacyProjectPanelRedirect panel="upload" /> },
  { path: "/projects/:id/results", element: <LegacyProjectPanelRedirect panel="results" /> },
  { path: "*", element: <Navigate to={WORKSPACE_ROOT} replace /> },
])

import { Navigate, createBrowserRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ROUTES } from "@/constants/routes";
import { DashboardPage } from "@/pages/DashboardPage";
import { FlightPlannerPage } from "@/pages/FlightPlannerPage";
import { NewProjectPage } from "@/pages/NewProjectPage";
import { ProjectDetailPage } from "@/pages/ProjectDetailPage";
import { ResultsPage } from "@/pages/ResultsPage";
import { SettingsPage } from "@/pages/SettingsPage";
import { UploadPage } from "@/pages/UploadPage";

export const router = createBrowserRouter([
  { path: ROUTES.ROOT, element: <Navigate to={ROUTES.DASHBOARD} replace /> },
  {
    element: <AppShell />,
    children: [
      { path: ROUTES.DASHBOARD, element: <DashboardPage /> },
      { path: ROUTES.PROJECT_NEW, element: <NewProjectPage /> },
      { path: ROUTES.PROJECT_DETAIL, element: <ProjectDetailPage /> },
      { path: ROUTES.PROJECT_PLAN, element: <FlightPlannerPage /> },
      { path: ROUTES.PROJECT_UPLOAD, element: <UploadPage /> },
      { path: ROUTES.PROJECT_RESULTS, element: <ResultsPage /> },
      { path: ROUTES.SETTINGS, element: <SettingsPage /> },
    ],
  },
]);

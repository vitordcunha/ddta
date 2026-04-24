import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui";
import { FlightPlannerWorkspace } from "@/features/flight-planner/components/FlightPlannerWorkspace";
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore";
import { useProjects } from "@/features/projects/hooks/useProjects";

export function FlightPlannerPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { getProject, updateProject } = useProjects();
  const project = id ? getProject(id) : undefined;

  const initialPlan = useMemo(() => {
    if (!project?.flightPlan?.plannerData) return null;
    return project.flightPlan.plannerData as PersistedFlightPlan;
  }, [project]);

  if (!project || !id) {
    return (
      <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900 p-6">
        <h2 className="text-lg font-medium">Projeto nao encontrado</h2>
        <Button variant="outline" onClick={() => navigate("/dashboard")}>
          Voltar ao dashboard
        </Button>
      </div>
    );
  }

  const handleSavePlan = (plan: PersistedFlightPlan) => {
    updateProject(id, {
      flightPlan: {
        id: `${id}-plan`,
        name: `Plano ${project.name}`,
        plannerData: plan,
      },
    });
  };

  return (
    <FlightPlannerWorkspace
      projectName={project.name}
      initialPlan={initialPlan}
      onSavePlan={handleSavePlan}
    />
  );
}

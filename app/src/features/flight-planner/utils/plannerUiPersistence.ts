import type { PlannerExpandedTabId } from "@/features/flight-planner/components/FlightPlannerExpandedModal";

const STORAGE_KEY = "flight:plannerUiShell";

const VALID_TABS: PlannerExpandedTabId[] = [
  "mission",
  "weather",
  "calibration",
  "export",
];

export type PlannerShellPrefs = {
  expandedOpen: boolean;
  activeTab: PlannerExpandedTabId;
};

export function readPlannerShellPrefs(): PlannerShellPrefs {
  if (typeof window === "undefined") {
    return { expandedOpen: false, activeTab: "mission" };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { expandedOpen: false, activeTab: "mission" };
    const o = JSON.parse(raw) as {
      expandedOpen?: unknown;
      activeTab?: unknown;
    };
    const expandedOpen = Boolean(o.expandedOpen);
    const tab = o.activeTab;
    const activeTab =
      typeof tab === "string" && VALID_TABS.includes(tab as PlannerExpandedTabId)
        ? (tab as PlannerExpandedTabId)
        : "mission";
    return { expandedOpen, activeTab };
  } catch {
    return { expandedOpen: false, activeTab: "mission" };
  }
}

export function writePlannerShellPrefs(prefs: PlannerShellPrefs): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota / private mode */
  }
}

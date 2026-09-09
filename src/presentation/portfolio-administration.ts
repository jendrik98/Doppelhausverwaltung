import { portfolioNavigation, queryBuildingWorkspace } from "../application";

type AnyRecord = Record<string, any>;

export const PORTFOLIO_ADMIN_PRESENTATION_VERSION = 1;

export interface PortfolioAdministrationBuilding {
  id: string;
  name: string;
  address: string;
  totalArea: number;
  year: string;
  primary: boolean;
  active: boolean;
  counts: {
    units: number;
    tenancies: number;
    meters: number;
    sources: number;
    costPositions: number;
    payments: number;
  };
}

export interface PortfolioAdministrationModel {
  portfolioId: string;
  portfolioName: string;
  activeBuildingId: string;
  primaryBuildingId: string;
  buildings: PortfolioAdministrationBuilding[];
}

export function createPortfolioAdministrationModel(state: AnyRecord, activeBuildingId = ""): PortfolioAdministrationModel {
  const nav = portfolioNavigation(state);
  const primaryBuildingId = String(state?.meta?.primaryBuildingId || nav.buildings[0]?.id || "");
  const active = String(activeBuildingId || nav.activeBuildingId || primaryBuildingId);
  return {
    portfolioId: String(nav.portfolio?.id || ""),
    portfolioName: String(nav.portfolio?.name || "Privatbestand"),
    activeBuildingId: active,
    primaryBuildingId,
    buildings: nav.buildings.map((building: AnyRecord) => {
      const id = String(building.id || "");
      const workspace = queryBuildingWorkspace(state, { buildingId: id });
      return {
        id,
        name: String(building.name || building.address || "Gebäude"),
        address: String(building.address || ""),
        totalArea: Number(building.totalArea || 0),
        year: String(building.year || ""),
        primary: id === primaryBuildingId,
        active: id === active,
        counts: {
          units: workspace.units.length,
          tenancies: workspace.tenancies.length,
          meters: workspace.meters.length,
          sources: workspace.sources.length,
          costPositions: workspace.costPositions.length,
          payments: workspace.payments.length
        }
      };
    })
  };
}

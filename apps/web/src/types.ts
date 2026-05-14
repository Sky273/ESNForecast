export interface Projection {
  months: MonthProjection[];
  summary: {
    totalRevenue: number;
    totalCosts: number;
    totalGrossMargin: number;
    finalCumulativeBalance: number;
    averageMarginRate: number;
    riskMonths: string[];
  };
  alerts: Array<{ type: string; severity: string; message: string; month?: string; entityId?: string }>;
}

export interface MonthProjection {
  month: string;
  revenue: { signed: number; expected: number; weighted: number; total: number };
  costs: { employees: number; partners: number; freelancers: number; fixed: number; variable: number; taxes: number; total: number };
  margins: { gross: number; net: number; rate: number };
  balance: { monthly: number; cumulative: number };
  activity: { soldDays: number; purchasedDays: number; internalUtilizationRate: number };
  details: {
    missions: Array<{ missionId: string; title: string; revenue: number; cost: number; margin: number }>;
    fixedCosts: Array<{ id: string; label: string; amount: number }>;
    variableCosts: Array<{ id: string; label: string; amount: number }>;
  };
  alerts: Array<{ type: string; severity: string; message: string }>;
}

export type Field = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "select" | "checkbox" | "textarea";
  options?: Array<{ label: string; value: string | number | boolean }>;
};

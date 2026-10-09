export type HostAllowance = {
  remaining: number | null;
  limit: number | null;
  unit: "links" | "bytes";
  period: "daily" | "weekly" | "monthly" | "current";
};
export type HostCheck = {
  domain: string;
  name: string;
  state: "available" | "listed" | "down" | "unsupported" | "queue" | "unknown" | "limited";
  icon: string | null;
  note: string | null;
  allowances: HostAllowance[];
  maxFileBytes: number | null;
  costFactor: number | null;
  limitsUnavailable: boolean;
  checkedAt: number;
};

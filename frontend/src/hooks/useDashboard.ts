import { useQuery } from "@tanstack/react-query";
import { client } from "./client";
import type { DashboardData } from "../types/api";

export function useDashboard() {
  return useQuery({
    queryKey: ["dashboard"],
    queryFn: async (): Promise<DashboardData> => {
      const { data } = await client.get<DashboardData>("/dashboard");
      return data;
    },
  });
}

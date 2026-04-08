import { useQuery } from "@tanstack/react-query";
import { client } from "./client";
import type { Mission } from "../types/api";

export function useMission(id: string) {
  return useQuery({
    queryKey: ["missions", id],
    queryFn: async (): Promise<Mission> => {
      const { data } = await client.get<Mission>(`/missions/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

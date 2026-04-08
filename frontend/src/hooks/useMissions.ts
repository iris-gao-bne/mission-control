import { useQuery } from "@tanstack/react-query";
import { client } from "./client";
import type { Mission } from "../types/api";

export function useMissions() {
  return useQuery({
    queryKey: ["missions"],
    queryFn: async (): Promise<Mission[]> => {
      const { data } = await client.get<Mission[]>("/missions");
      return data;
    },
  });
}

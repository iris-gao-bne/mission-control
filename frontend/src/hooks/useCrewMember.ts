import { useQuery } from "@tanstack/react-query";
import { client } from "./client";
import type { CrewMemberDetail } from "../types/api";

export function useCrewMember(id: string) {
  return useQuery({
    queryKey: ["crew", id],
    queryFn: async (): Promise<CrewMemberDetail> => {
      const { data } = await client.get<CrewMemberDetail>(`/crew/${id}`);
      return data;
    },
    enabled: !!id,
  });
}

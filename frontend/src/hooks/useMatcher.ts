import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from './client'
import type { MatchResult } from '../types/api'

export function useMatcher(missionId: string) {
  return useQuery({
    queryKey: ['matcher', missionId],
    queryFn: async (): Promise<MatchResult> => {
      const { data } = await client.get<MatchResult>(`/missions/${missionId}/match`)
      return data
    },
    enabled: false, // only fetches when refetch() is called
    staleTime: 0,   // always re-fetch on demand
  })
}

interface Assignment {
  userId: string
  requirementId?: string
}

export function useAssignCrew(missionId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (assignments: Assignment[]) => {
      await client.post(`/missions/${missionId}/assign`, { assignments })
    },
    onSuccess: () => {
      // Refresh the mission detail and clear the stale matcher result
      queryClient.invalidateQueries({ queryKey: ['missions', missionId] })
      queryClient.removeQueries({ queryKey: ['matcher', missionId] })
    },
  })
}

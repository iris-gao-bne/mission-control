import { useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from './client'
import type { AssignmentStatus } from '../types/api'

interface Vars {
  crewId: string
  assignmentId: string
  status: AssignmentStatus
}

export function useUpdateAssignmentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ crewId, assignmentId, status }: Vars) => {
      const { data } = await client.patch(
        `/crew/${crewId}/assignments/${assignmentId}`,
        { status }
      )
      return data
    },
    onSuccess: (_data, { crewId }) => {
      // Refresh both the crew detail and missions list so status is up to date
      queryClient.invalidateQueries({ queryKey: ['crew', crewId] })
      queryClient.invalidateQueries({ queryKey: ['missions'] })
    },
  })
}

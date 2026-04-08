import { useMutation, useQueryClient } from '@tanstack/react-query'
import { client } from './client'

export interface AvailabilityInput {
  startDate: string
  endDate: string
  reason?: string
}

export function useUpdateAvailability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      crewId,
      availability,
    }: {
      crewId: string
      availability: AvailabilityInput[]
    }) => {
      const { data } = await client.patch(`/crew/${crewId}/availability`, {
        availability,
      })
      return data
    },
    onSuccess: (_data, { crewId }) => {
      queryClient.invalidateQueries({ queryKey: ['crew', crewId] })
    },
  })
}

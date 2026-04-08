import { useQuery } from '@tanstack/react-query'
import { client } from './client'
import type { CrewMember } from '../types/api'

export function useCrew() {
  return useQuery({
    queryKey: ['crew'],
    queryFn: async (): Promise<CrewMember[]> => {
      const { data } = await client.get<CrewMember[]>('/crew')
      return data
    },
  })
}

import { useMutation } from '@tanstack/react-query'
import { client } from './client'
import type { LoginResponse } from '../types/api'

interface LoginPayload {
  slug: string
  email: string
  password: string
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (payload: LoginPayload): Promise<LoginResponse> => {
      const { data } = await client.post<LoginResponse>('/auth/login', payload)
      return data
    },
  })
}

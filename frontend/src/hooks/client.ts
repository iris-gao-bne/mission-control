import axios from 'axios'

export const client = axios.create({
  baseURL: '/api',
})

// Inject the JWT on every request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Surface the error message from the backend { error: string } shape
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.error ?? err.message ?? 'Unknown error'
    return Promise.reject(new Error(message))
  }
)

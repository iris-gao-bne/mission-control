import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ChakraProvider, extendTheme } from '@chakra-ui/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from './context/AuthContext'
import { App } from './App'

const theme = extendTheme({
  fonts: {
    heading: `system-ui, -apple-system, 'Segoe UI', sans-serif`,
    body: `system-ui, -apple-system, 'Segoe UI', sans-serif`,
  },
  styles: {
    global: {
      body: { bg: 'gray.50', color: 'gray.800' },
    },
  },
  components: {
    Button: {
      defaultProps: { colorScheme: 'blue' },
    },
    Input: {
      defaultProps: { focusBorderColor: 'blue.500' },
    },
    Select: {
      defaultProps: { focusBorderColor: 'blue.500' },
    },
  },
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ChakraProvider theme={theme}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </QueryClientProvider>
    </ChakraProvider>
  </StrictMode>
)

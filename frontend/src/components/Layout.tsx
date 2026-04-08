import { Flex, Box } from '@chakra-ui/react'
import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { Sidebar } from './Sidebar'

export function Layout() {
  const { isAuthenticated } = useAuth()

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return (
    <Flex minH="100vh" bg="gray.50">
      <Sidebar />
      <Box flex={1} overflowY="auto" p={8}>
        <Box maxW="1200px" mx="auto">
          <Outlet />
        </Box>
      </Box>
    </Flex>
  )
}

import { Box, Flex, Text, VStack, Button, Divider } from '@chakra-ui/react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import type { Role } from '../types/api'

interface NavItem {
  label: string
  icon: string
  to: string
  roles: Role[]
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', icon: '◈', to: '/dashboard', roles: ['DIRECTOR', 'MISSION_LEAD', 'CREW_MEMBER'] },
  { label: 'Missions',  icon: '◎', to: '/missions',  roles: ['DIRECTOR', 'MISSION_LEAD', 'CREW_MEMBER'] },
  { label: 'Crew',      icon: '◉', to: '/crew',      roles: ['DIRECTOR', 'MISSION_LEAD', 'CREW_MEMBER'] },
]

const ROLE_LABEL: Record<Role, string> = {
  DIRECTOR: 'Director',
  MISSION_LEAD: 'Mission Lead',
  CREW_MEMBER: 'Crew Member',
}

function userInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  if (!user) return null

  const visibleItems = NAV_ITEMS.filter((item) => item.roles.includes(user.role))

  function handleLogout() {
    queryClient.clear()
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <Flex
      direction="column"
      w="220px"
      minH="100vh"
      bg="gray.900"
      color="white"
      flexShrink={0}
      py={6}
      px={4}
      borderRight="1px solid"
      borderColor="gray.800"
    >
      {/* Brand */}
      <Box mb={8} px={2}>
        <Text fontWeight="bold" fontSize="md" letterSpacing="tight" color="white">
          🚀 Mission Control
        </Text>
        <Text
          fontSize="xs"
          color="blue.400"
          mt={0.5}
          noOfLines={1}
          fontWeight="medium"
          letterSpacing="wide"
          textTransform="uppercase"
        >
          {user.orgName}
        </Text>
      </Box>

      {/* Nav */}
      <VStack spacing={0.5} align="stretch" flex={1}>
        {visibleItems.map((item) => (
          <NavLink key={item.to} to={item.to} style={{ display: 'block' }}>
            {({ isActive }) => (
              <Flex
                align="center"
                gap={3}
                px={3}
                py={2.5}
                borderRadius="md"
                borderLeft="3px solid"
                borderLeftColor={isActive ? 'blue.400' : 'transparent'}
                bg={isActive ? 'whiteAlpha.100' : 'transparent'}
                _hover={{ bg: 'whiteAlpha.100' }}
                transition="all 0.15s"
                cursor="pointer"
              >
                <Text
                  fontSize="xs"
                  color={isActive ? 'blue.400' : 'gray.500'}
                  lineHeight={1}
                  flexShrink={0}
                >
                  {item.icon}
                </Text>
                <Text
                  fontSize="sm"
                  fontWeight={isActive ? 'semibold' : 'normal'}
                  color={isActive ? 'white' : 'gray.300'}
                >
                  {item.label}
                </Text>
              </Flex>
            )}
          </NavLink>
        ))}
      </VStack>

      {/* User footer */}
      <Box>
        <Divider borderColor="gray.800" mb={4} />
        <Flex align="center" gap={3} px={1} mb={3}>
          {/* Avatar initials */}
          <Flex
            w={8}
            h={8}
            borderRadius="full"
            bg="blue.700"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Text fontSize="xs" fontWeight="bold" color="white">
              {userInitials(user.name)}
            </Text>
          </Flex>
          <Box minW={0}>
            <Text fontSize="sm" fontWeight="medium" color="white" noOfLines={1}>
              {user.name}
            </Text>
            <Text fontSize="xs" color="gray.500">
              {ROLE_LABEL[user.role]}
            </Text>
          </Box>
        </Flex>
        <Button
          size="sm"
          variant="ghost"
          color="gray.500"
          _hover={{ bg: 'whiteAlpha.100', color: 'gray.200' }}
          onClick={handleLogout}
          w="full"
          justifyContent="flex-start"
          fontWeight="normal"
          fontSize="xs"
        >
          Sign out
        </Button>
      </Box>
    </Flex>
  )
}

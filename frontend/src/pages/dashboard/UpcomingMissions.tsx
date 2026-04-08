import { Badge, Box, Divider, Flex, Text } from '@chakra-ui/react'
import type { MissionSummary } from '../../types/api'

interface Props {
  missions: MissionSummary[]
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function UpcomingMissions({ missions }: Props) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
    >
      <Flex align="center" gap={2.5} px={5} py={4}>
        <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          Upcoming
        </Text>
        <Text fontSize="xs" color="gray.400">next 30 days</Text>
      </Flex>

      {missions.length === 0 ? (
        <Box px={5} pb={5}>
          <Text fontSize="sm" color="gray.400">No missions starting in the next 30 days.</Text>
        </Box>
      ) : (
        <>
          <Divider />
          {missions.map((m, i) => (
            <Box key={m.id}>
              <Flex align="center" justify="space-between" px={5} py={3} gap={4}>
                <Text fontSize="sm" fontWeight="medium" color="gray.800" noOfLines={1} flex={1}>
                  {m.name}
                </Text>
                <Flex align="center" gap={2.5} flexShrink={0}>
                  <Text fontSize="xs" color="gray.400">
                    {fmt(m.startDate)} – {fmt(m.endDate)}
                  </Text>
                  <Badge colorScheme="green" variant="subtle" borderRadius="full" px={2} fontSize="xs">
                    Approved
                  </Badge>
                </Flex>
              </Flex>
              {i < missions.length - 1 && <Divider />}
            </Box>
          ))}
        </>
      )}
    </Box>
  )
}

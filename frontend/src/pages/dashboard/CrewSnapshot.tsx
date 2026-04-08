import { Badge, Box, Flex, SimpleGrid, Text } from '@chakra-ui/react'
import type { CrewStats } from '../../types/api'

interface MiniStatProps {
  label: string
  value: number
  accent?: string
  sub?: string
}

function MiniStat({ label, value, accent, sub }: MiniStatProps) {
  return (
    <Box>
      <Text fontSize="2xl" fontWeight="bold" color={accent ?? 'gray.800'} lineHeight={1}>
        {value}
      </Text>
      <Text fontSize="xs" color="gray.500" mt={1}>
        {label}
      </Text>
      {sub && (
        <Text fontSize="xs" color="gray.400">
          {sub}
        </Text>
      )}
    </Box>
  )
}

interface Props {
  crew: CrewStats
  missionsNeedingCrew: number
}

export function CrewSnapshot({ crew, missionsNeedingCrew }: Props) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      p={5}
    >
      <Flex align="center" justify="space-between" mb={5}>
        <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          Crew
        </Text>
        {missionsNeedingCrew > 0 && (
          <Badge colorScheme="orange" variant="subtle" borderRadius="full" px={2} fontSize="xs">
            {missionsNeedingCrew} {missionsNeedingCrew === 1 ? 'mission needs' : 'missions need'} crew
          </Badge>
        )}
      </Flex>

      <SimpleGrid columns={3} spacing={5}>
        <MiniStat label="Total"      value={crew.total} />
        <MiniStat label="Available"  value={crew.available}        accent="green.600" />
        <MiniStat label="On Mission" value={crew.onActiveMissions} accent="blue.600" />
        <MiniStat label="On Leave"   value={crew.onLeave}          accent="orange.500" />
        <MiniStat label="Skill Depth" value={crew.skillDepth}      accent="purple.600" sub="proficiency ≥ 3" />
      </SimpleGrid>
    </Box>
  )
}

import { Badge, Box, Divider, Flex, Text, VStack } from '@chakra-ui/react'
import type { Mission, MissionAssignment, MissionRequirement } from '../../types/api'

interface Props {
  mission: Mission
}

// ─── Proficiency pip display ──────────────────────────────────────────────────

function ProficiencyPips({ level, min }: { level: number; min: number }) {
  return (
    <Flex gap={0.5} align="center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Box
          key={i}
          w={2}
          h={2}
          borderRadius="full"
          bg={i < level ? (i < min - 1 ? 'gray.300' : 'blue.500') : 'gray.100'}
        />
      ))}
    </Flex>
  )
}

// ─── Single crew row ──────────────────────────────────────────────────────────

function AssignedCrew({ assignment }: { assignment: MissionAssignment }) {
  return (
    <Flex align="center" gap={2.5} py={2} px={3} borderRadius="md" bg="gray.50">
      <Box w={1.5} h={1.5} borderRadius="full" bg="blue.400" flexShrink={0} />
      <Text fontSize="sm" color="gray.700" fontWeight="medium">
        {assignment.user.name}
      </Text>
      <Text fontSize="xs" color="gray.400">{assignment.user.email}</Text>
    </Flex>
  )
}

function EmptySlot() {
  return (
    <Flex
      align="center"
      gap={2.5}
      py={2}
      px={3}
      borderRadius="md"
      border="1px dashed"
      borderColor="gray.200"
    >
      <Box w={1.5} h={1.5} borderRadius="full" bg="gray.300" flexShrink={0} />
      <Text fontSize="sm" color="gray.400">Unfilled slot</Text>
    </Flex>
  )
}

// ─── Single requirement block ─────────────────────────────────────────────────

function RequirementBlock({
  requirement,
  assignments,
}: {
  requirement: MissionRequirement
  assignments: MissionAssignment[]
}) {
  const filled = assignments.length
  const total = requirement.headcount
  const isFull = filled >= total

  return (
    <Box>
      {/* Requirement header */}
      <Flex align="center" gap={3} mb={2.5} flexWrap="wrap">
        <Text fontSize="sm" fontWeight="semibold" color="gray.800">
          {requirement.skill.name}
        </Text>
        <Text fontSize="xs" color="gray.400">
          {requirement.skill.category}
        </Text>
        <Flex align="center" gap={1.5} ml="auto" flexShrink={0}>
          <Text fontSize="xs" color="gray.400">min L{requirement.minProficiency}</Text>
          <ProficiencyPips level={requirement.minProficiency} min={requirement.minProficiency} />
          <Badge
            colorScheme={isFull ? 'green' : filled > 0 ? 'yellow' : 'gray'}
            variant="subtle"
            borderRadius="full"
            px={2}
            fontSize="xs"
          >
            {filled}/{total}
          </Badge>
        </Flex>
      </Flex>

      {/* Crew rows */}
      <VStack spacing={1.5} align="stretch">
        {assignments.map((a) => (
          <AssignedCrew key={a.id} assignment={a} />
        ))}
        {Array.from({ length: total - filled }).map((_, i) => (
          <EmptySlot key={i} />
        ))}
      </VStack>
    </Box>
  )
}

// ─── Unlinked assignments ─────────────────────────────────────────────────────

function UnlinkedSection({ assignments }: { assignments: MissionAssignment[] }) {
  if (assignments.length === 0) return null
  return (
    <Box>
      <Text fontSize="xs" color="gray.400" mb={2}>
        Assigned without a specific requirement
      </Text>
      <VStack spacing={1.5} align="stretch">
        {assignments.map((a) => (
          <AssignedCrew key={a.id} assignment={a} />
        ))}
      </VStack>
    </Box>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RequirementsList({ mission }: Props) {
  // Group assignments by requirementId
  const byReqId = new Map<string, MissionAssignment[]>()
  const unlinked: MissionAssignment[] = []

  for (const a of mission.assignments) {
    if (a.missionRequirementId) {
      if (!byReqId.has(a.missionRequirementId)) byReqId.set(a.missionRequirementId, [])
      byReqId.get(a.missionRequirementId)!.push(a)
    } else {
      unlinked.push(a)
    }
  }

  const hasContent = mission.requirements.length > 0 || mission.assignments.length > 0

  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      p={5}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        color="gray.500"
        textTransform="uppercase"
        letterSpacing="wider"
        mb={4}
      >
        Requirements & Crew
      </Text>

      {!hasContent && (
        <Text fontSize="sm" color="gray.400">
          No requirements defined for this mission.
        </Text>
      )}

      <VStack spacing={0} align="stretch" divider={<Divider />}>
        {mission.requirements.map((req) => (
          <Box key={req.id} py={4} _first={{ pt: 0 }} _last={{ pb: 0 }}>
            <RequirementBlock
              requirement={req}
              assignments={byReqId.get(req.id) ?? []}
            />
          </Box>
        ))}
      </VStack>

      {unlinked.length > 0 && (
        <>
          {mission.requirements.length > 0 && <Divider my={4} />}
          <UnlinkedSection assignments={unlinked} />
        </>
      )}
    </Box>
  )
}

import { Badge, Box, Checkbox, Flex, Text, VStack } from "@chakra-ui/react";
import type { RequirementMatch } from "../../types/api";

function ScoreBreakdown({
  breakdown,
}: {
  breakdown: { proficiency: number; availability: number; workload: number };
}) {
  return (
    <Flex gap={1.5} align="center">
      <Text fontSize="xs" color="blue.500" title="Proficiency score">
        P{breakdown.proficiency}
      </Text>
      <Text fontSize="xs" color="gray.300">
        ·
      </Text>
      <Text
        fontSize="xs"
        color={breakdown.availability > 0 ? "green.500" : "red.400"}
        title="Availability score"
      >
        A{breakdown.availability}
      </Text>
      <Text fontSize="xs" color="gray.300">
        ·
      </Text>
      <Text fontSize="xs" color="orange.500" title="Workload score">
        W{breakdown.workload}
      </Text>
    </Flex>
  );
}

interface Props {
  requirement: RequirementMatch;
  selected: Set<string>;
  onToggle: (userId: string) => void;
}

export function MatcherRequirement({ requirement, selected, onToggle }: Props) {
  const {
    skill,
    minProficiency,
    headcount,
    suggestions,
    filled,
    unfilled,
    gap,
  } = requirement;

  return (
    <Box
      border="1px solid"
      borderColor="gray.200"
      borderRadius="lg"
      overflow="hidden"
    >
      {/* Requirement header */}
      <Flex
        align="center"
        justify="space-between"
        px={4}
        py={3}
        bg="gray.50"
        borderBottom="1px solid"
        borderColor="gray.200"
        gap={3}
        flexWrap="wrap"
      >
        <Box>
          <Text fontSize="sm" fontWeight="semibold" color="gray.800">
            {skill.name}
          </Text>
          <Text fontSize="xs" color="gray.400">
            {skill.category} · min L{minProficiency}
          </Text>
        </Box>
        <Flex align="center" gap={2}>
          <Badge
            colorScheme={
              unfilled === 0 ? "green" : filled > 0 ? "yellow" : "gray"
            }
            variant="subtle"
            borderRadius="full"
            px={2}
            fontSize="xs"
          >
            {filled}/{headcount} filled
          </Badge>
          <Text fontSize="xs" color="gray.400">
            {selected.size} selected
          </Text>
        </Flex>
      </Flex>

      {/* Suggestions list */}
      {gap && suggestions.length === 0 ? (
        <Box px={4} py={3}>
          <Text fontSize="sm" color="gray.400">
            {gap}
          </Text>
        </Box>
      ) : (
        <VStack
          spacing={0}
          align="stretch"
          divider={<Box borderBottom="1px solid" borderColor="gray.100" />}
        >
          {suggestions.map((s) => {
            const isSelected = selected.has(s.userId);
            const isAlgoAssigned = s.assigned;
            return (
              <Flex
                key={s.userId}
                align="center"
                gap={3}
                px={4}
                py={3}
                bg={isSelected ? "blue.50" : "white"}
                cursor="pointer"
                _hover={{ bg: isSelected ? "blue.50" : "gray.50" }}
                transition="background 0.1s"
                onClick={() => onToggle(s.userId)}
              >
                <Checkbox
                  isChecked={isSelected}
                  onChange={() => onToggle(s.userId)}
                  onClick={(e) => e.stopPropagation()}
                  colorScheme="blue"
                  flexShrink={0}
                />

                {/* Avatar initials */}
                <Flex
                  w={7}
                  h={7}
                  borderRadius="full"
                  bg={isSelected ? "blue.600" : "gray.200"}
                  align="center"
                  justify="center"
                  flexShrink={0}
                  transition="background 0.1s"
                >
                  <Text
                    fontSize="xs"
                    fontWeight="bold"
                    color={isSelected ? "white" : "gray.500"}
                  >
                    {s.name
                      .split(" ")
                      .slice(0, 2)
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </Text>
                </Flex>

                {/* Name + score */}
                <Box flex={1} minW={0}>
                  <Flex align="center" gap={2}>
                    <Text
                      fontSize="sm"
                      fontWeight="medium"
                      color="gray.800"
                      noOfLines={1}
                    >
                      {s.name}
                    </Text>
                    {isAlgoAssigned && (
                      <Badge
                        colorScheme="blue"
                        variant="subtle"
                        fontSize="xs"
                        borderRadius="full"
                        px={1.5}
                      >
                        Suggested
                      </Badge>
                    )}
                  </Flex>
                  <Text fontSize="xs" color="gray.400">
                    {s.email}
                  </Text>
                </Box>

                {/* Score + breakdown */}
                <Flex
                  direction="column"
                  align="flex-end"
                  gap={0.5}
                  flexShrink={0}
                >
                  <Text
                    fontSize="sm"
                    fontWeight="semibold"
                    color={isSelected ? "blue.600" : "gray.600"}
                  >
                    {s.score}
                  </Text>
                  <ScoreBreakdown breakdown={s.breakdown} />
                </Flex>

                {/* Proficiency */}
                <Text
                  fontSize="xs"
                  color="gray.500"
                  w={6}
                  textAlign="right"
                  flexShrink={0}
                >
                  L{s.proficiency}
                </Text>
              </Flex>
            );
          })}

          {/* Gap warning when some candidates but still insufficient */}
          {gap && suggestions.length > 0 && (
            <Box px={4} py={2} bg="orange.50">
              <Text fontSize="xs" color="orange.600">
                {gap}
              </Text>
            </Box>
          )}
        </VStack>
      )}
    </Box>
  );
}

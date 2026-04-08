import { Box, Divider, Flex, Text, VStack } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import type { CrewMember } from "../../types/api";

function ProficiencyDots({ level }: { level: number }) {
  return (
    <Flex gap={0.5} align="center">
      {Array.from({ length: 5 }).map((_, i) => (
        <Box
          key={i}
          w={2}
          h={2}
          borderRadius="full"
          bg={i < level ? "blue.400" : "gray.100"}
          flexShrink={0}
        />
      ))}
    </Flex>
  );
}

function userInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

interface Props {
  member: CrewMember;
}

export function CrewCard({ member }: Props) {
  const { name, email, skills, activeMissionCount } = member;

  const missionColor =
    activeMissionCount === 0
      ? "gray.400"
      : activeMissionCount >= 2
        ? "orange.500"
        : "blue.500";

  return (
    <Link
      to={`/crew/${member.id}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <Box
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="sm"
        p={5}
        display="flex"
        _hover={{
          boxShadow: "md",
          borderColor: "gray.300",
          transform: "translateY(-1px)",
        }}
        transition="all 0.15s"
        cursor="pointer"
        flexDirection="column"
        gap={4}
      >
        {/* Avatar + name */}
        <Flex align="center" gap={3}>
          <Flex
            w={10}
            h={10}
            borderRadius="full"
            bg="blue.700"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Text fontSize="sm" fontWeight="bold" color="white">
              {userInitials(name)}
            </Text>
          </Flex>
          <Box minW={0}>
            <Text
              fontWeight="semibold"
              fontSize="sm"
              color="gray.800"
              noOfLines={1}
            >
              {name}
            </Text>
            <Text fontSize="xs" color="gray.400" noOfLines={1}>
              {email}
            </Text>
          </Box>
        </Flex>

        <Divider />

        {/* Skills */}
        {skills.length === 0 ? (
          <Text fontSize="xs" color="gray.400">
            No skills on profile
          </Text>
        ) : (
          <VStack spacing={2.5} align="stretch">
            {skills.map((cs) => (
              <Flex
                key={cs.skill.id}
                align="center"
                justify="space-between"
                gap={3}
              >
                <Box minW={0}>
                  <Text
                    fontSize="xs"
                    color="gray.700"
                    fontWeight="medium"
                    noOfLines={1}
                  >
                    {cs.skill.name}
                  </Text>
                  <Text fontSize="xs" color="gray.400">
                    {cs.skill.category}
                  </Text>
                </Box>
                <Flex align="center" gap={2} flexShrink={0}>
                  <ProficiencyDots level={cs.proficiencyLevel} />
                  <Text fontSize="xs" color="gray.500" w={4} textAlign="right">
                    L{cs.proficiencyLevel}
                  </Text>
                </Flex>
              </Flex>
            ))}
          </VStack>
        )}

        <Divider />

        {/* Active missions */}
        <Flex align="center" gap={2}>
          <Box
            w={2}
            h={2}
            borderRadius="full"
            bg={missionColor}
            flexShrink={0}
          />
          <Text fontSize="xs" color={missionColor} fontWeight="medium">
            {activeMissionCount === 0
              ? "No active missions"
              : `${activeMissionCount} active mission${activeMissionCount === 1 ? "" : "s"}`}
          </Text>
        </Flex>
      </Box>
    </Link>
  );
}

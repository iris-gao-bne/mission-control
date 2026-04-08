import { Badge, Box, Flex, Text } from "@chakra-ui/react";
import type { MissionSummary } from "../../types/api";

interface Props {
  mission: MissionSummary | null;
}

const STATUS_COLOR: Record<string, string> = {
  IN_PROGRESS: "blue",
  APPROVED: "green",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function NextMissionBanner({ mission }: Props) {
  if (!mission) {
    return (
      <Box
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        boxShadow="sm"
        p={6}
      >
        <Text fontSize="sm" color="gray.400">
          You have no upcoming mission assignments.
        </Text>
      </Box>
    );
  }

  const colorScheme = STATUS_COLOR[mission.status] ?? "gray";

  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor={`${colorScheme}.200`}
      boxShadow="sm"
      px={6}
      py={5}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        color="gray.500"
        textTransform="uppercase"
        letterSpacing="wider"
        mb={3}
      >
        Your Next Mission
      </Text>
      <Flex align="center" gap={3} flexWrap="wrap">
        <Text fontWeight="bold" fontSize="xl" color="gray.800">
          {mission.name}
        </Text>
        <Badge
          colorScheme={colorScheme}
          variant="subtle"
          borderRadius="full"
          px={2}
        >
          {mission.status.replace("_", " ")}
        </Badge>
      </Flex>
      <Text fontSize="sm" color="gray.500" mt={2}>
        {formatDate(mission.startDate)} → {formatDate(mission.endDate)}
      </Text>
    </Box>
  );
}

import { Badge, Box, Divider, Flex, Text } from "@chakra-ui/react";
import type { MissionSummary, MissionStatus } from "../../types/api";

interface Props {
  missions: MissionSummary[];
}

const STATUS_COLOR: Record<MissionStatus, string> = {
  DRAFT: "gray",
  SUBMITTED: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  IN_PROGRESS: "blue",
  COMPLETED: "teal",
  CANCELLED: "orange",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MyMissionsList({ missions }: Props) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
    >
      <Flex align="center" justify="space-between" px={5} py={4}>
        <Text fontWeight="semibold" fontSize="sm" color="gray.800">
          Your Missions
        </Text>
        <Text fontSize="xs" color="gray.400">
          {missions.length} total
        </Text>
      </Flex>

      {missions.length === 0 ? (
        <Box px={5} pb={5}>
          <Text fontSize="sm" color="gray.400">
            You have no mission assignments.
          </Text>
        </Box>
      ) : (
        <>
          <Divider />
          {missions.map((m, i) => (
            <Box key={m.id}>
              <Flex
                align="center"
                justify="space-between"
                px={5}
                py={3.5}
                flexWrap="wrap"
                gap={2}
              >
                <Text fontWeight="medium" fontSize="sm" color="gray.800">
                  {m.name}
                </Text>
                <Flex align="center" gap={3}>
                  <Text fontSize="xs" color="gray.500">
                    {formatDate(m.startDate)} → {formatDate(m.endDate)}
                  </Text>
                  <Badge
                    colorScheme={STATUS_COLOR[m.status]}
                    variant="subtle"
                    borderRadius="full"
                    px={2}
                    fontSize="xs"
                  >
                    {m.status.replace("_", " ")}
                  </Badge>
                </Flex>
              </Flex>
              {i < missions.length - 1 && <Divider />}
            </Box>
          ))}
        </>
      )}
    </Box>
  );
}

import { Box, Flex, Text } from "@chakra-ui/react";
import type { MissionStatus } from "../../types/api";

interface Props {
  missionsByStatus: Record<MissionStatus, number>;
}

const STATUSES: { key: MissionStatus; label: string; accent: string }[] = [
  { key: "DRAFT", label: "Draft", accent: "gray.700" },
  { key: "SUBMITTED", label: "Submitted", accent: "yellow.600" },
  { key: "APPROVED", label: "Approved", accent: "green.600" },
  { key: "IN_PROGRESS", label: "In Progress", accent: "blue.600" },
  { key: "COMPLETED", label: "Completed", accent: "teal.600" },
];

export function MissionPipeline({ missionsByStatus }: Props) {
  return (
    <Flex
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      overflow="hidden"
    >
      {STATUSES.map(({ key, label, accent }, i) => {
        const value = missionsByStatus[key] ?? 0;
        return (
          <Box
            key={key}
            flex={1}
            px={5}
            py={4}
            borderLeft={i > 0 ? "1px solid" : "none"}
            borderColor="gray.100"
          >
            <Text fontSize="xs" color="gray.400" mb={1.5} fontWeight="medium">
              {label}
            </Text>
            <Text
              fontSize="2xl"
              fontWeight="bold"
              lineHeight={1}
              color={value > 0 ? accent : "gray.200"}
            >
              {value}
            </Text>
          </Box>
        );
      })}
    </Flex>
  );
}

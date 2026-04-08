import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import type { Mission } from "../../types/api";

interface Props {
  mission: Mission;
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MissionHeader({ mission }: Props) {
  return (
    <Box>
      {/* Back link */}
      <Text
        as={Link}
        to="/missions"
        fontSize="xs"
        color="gray.400"
        _hover={{ color: "blue.500" }}
        display="inline-flex"
        alignItems="center"
        gap={1}
        mb={4}
      >
        ← Missions
      </Text>

      {/* Title row */}
      <Flex align="flex-start" justify="space-between" gap={4} flexWrap="wrap">
        <Box>
          <Heading
            size="lg"
            color="gray.800"
            fontWeight="semibold"
            lineHeight="short"
          >
            {mission.name}
          </Heading>
          <Text fontSize="sm" color="gray.400" mt={1}>
            Created by{" "}
            <Text as="span" color="gray.600" fontWeight="medium">
              {mission.createdBy.name}
            </Text>
            {" · "}
            {fmt(mission.createdAt)}
          </Text>
        </Box>

        <StatusBadge status={mission.status} size="md" />
      </Flex>
    </Box>
  );
}

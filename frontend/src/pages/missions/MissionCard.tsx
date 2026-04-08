import { Box, Flex, Heading, Text } from "@chakra-ui/react";
import { Link } from "react-router-dom";
import { StatusBadge } from "../../components/StatusBadge";
import { DaysUntilBadge } from "./DaysUntilBadge";
import { CardFooter } from "./CardFooter";
import type { Mission, MissionStatus } from "../../types/api";

const LEFT_BORDER: Record<MissionStatus, string> = {
  DRAFT: "gray.300",
  SUBMITTED: "yellow.400",
  APPROVED: "green.400",
  REJECTED: "red.400",
  IN_PROGRESS: "blue.500",
  COMPLETED: "teal.400",
  CANCELLED: "orange.400",
};

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function durationDays(start: string, end: string) {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86400000,
  );
}

interface Props {
  mission: Mission;
}

export function MissionCard({ mission }: Props) {
  const duration = durationDays(mission.startDate, mission.endDate);

  return (
    <Link
      to={`/missions/${mission.id}`}
      style={{ display: "block", textDecoration: "none" }}
    >
      <Box
        bg="white"
        borderRadius="lg"
        border="1px solid"
        borderColor="gray.200"
        borderLeft="3px solid"
        borderLeftColor={LEFT_BORDER[mission.status]}
        boxShadow="sm"
        p={5}
        h="full"
        _hover={{
          boxShadow: "md",
          borderColor: "gray.300",
          transform: "translateY(-1px)",
        }}
        transition="all 0.15s"
        cursor="pointer"
      >
        {/* Status row */}
        <Flex align="center" justify="space-between" mb={3}>
          <StatusBadge status={mission.status} />
          <DaysUntilBadge
            startDate={mission.startDate}
            endDate={mission.endDate}
            status={mission.status}
          />
        </Flex>

        {/* Name */}
        <Heading
          size="sm"
          color="gray.800"
          fontWeight="semibold"
          lineHeight="short"
          mb={1.5}
          noOfLines={2}
        >
          {mission.name}
        </Heading>

        {/* Description */}
        <Text
          fontSize="xs"
          color="gray.500"
          noOfLines={2}
          lineHeight="tall"
          mb={3}
        >
          {mission.description ?? "No description provided."}
        </Text>

        {/* Meta row */}
        <Flex align="center" gap={1} flexWrap="wrap">
          <Text
            fontSize="xs"
            color="gray.500"
            fontWeight="medium"
            noOfLines={1}
          >
            {mission.createdBy.name}
          </Text>
          <Text fontSize="xs" color="gray.300">
            ·
          </Text>
          <Text fontSize="xs" color="gray.400">
            {fmt(mission.startDate)} – {fmt(mission.endDate)}
          </Text>
          <Text fontSize="xs" color="gray.300">
            ·
          </Text>
          <Text fontSize="xs" color="gray.400">
            {duration}d
          </Text>
        </Flex>

        <CardFooter mission={mission} />
      </Box>
    </Link>
  );
}

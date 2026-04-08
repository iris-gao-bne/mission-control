import { Box, Divider, SimpleGrid, Text } from "@chakra-ui/react";
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

function durationDays(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return Math.round(ms / (1000 * 60 * 60 * 24));
}

function MetaField({ label, value }: { label: string; value: string }) {
  return (
    <Box>
      <Text fontSize="xs" color="gray.400" mb={0.5}>
        {label}
      </Text>
      <Text fontSize="sm" fontWeight="medium" color="gray.700">
        {value}
      </Text>
    </Box>
  );
}

export function MissionOverview({ mission }: Props) {
  const duration = durationDays(mission.startDate, mission.endDate);

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
        mb={3}
      >
        Overview
      </Text>

      {mission.description ? (
        <Text fontSize="sm" color="gray.700" lineHeight="tall" mb={5}>
          {mission.description}
        </Text>
      ) : (
        <Text fontSize="sm" color="gray.400" mb={5}>
          No description provided.
        </Text>
      )}

      <Divider mb={4} />

      <SimpleGrid columns={{ base: 2, md: 4 }} spacing={5}>
        <MetaField label="Start date" value={fmt(mission.startDate)} />
        <MetaField label="End date" value={fmt(mission.endDate)} />
        <MetaField
          label="Duration"
          value={`${duration} day${duration === 1 ? "" : "s"}`}
        />
        <MetaField label="Created" value={fmt(mission.createdAt)} />
      </SimpleGrid>
    </Box>
  );
}

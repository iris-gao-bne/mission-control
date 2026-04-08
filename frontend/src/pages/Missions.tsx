import { useState } from "react";
import { Box, Button, Flex, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { useMissions } from "../hooks/useMissions";
import { PageSpinner } from "../components/PageSpinner";
import { PageError } from "../components/PageError";
import { MissionCard } from "./missions/MissionCard";
import type { MissionStatus } from "../types/api";

type FilterKey = MissionStatus | "all" | "archived";

const TABS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "APPROVED", label: "Approved" },
  { key: "IN_PROGRESS", label: "In Progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "archived", label: "Archived" },
];

const ARCHIVED: MissionStatus[] = ["REJECTED", "CANCELLED"];

export function Missions() {
  const {
    data: missions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useMissions();
  const [filter, setFilter] = useState<FilterKey>("all");

  if (isLoading) return <PageSpinner />;
  if (isError) return <PageError message={error?.message} onRetry={refetch} />;

  const filtered =
    filter === "all"
      ? missions
      : filter === "archived"
        ? missions.filter((m) => ARCHIVED.includes(m.status))
        : missions.filter((m) => m.status === filter);

  // Badge counts for tabs
  const countFor = (key: FilterKey) =>
    key === "all"
      ? missions.length
      : key === "archived"
        ? missions.filter((m) => ARCHIVED.includes(m.status)).length
        : missions.filter((m) => m.status === key).length;

  return (
    <Box>
      {/* Page header */}
      <Box mb={6}>
        <Heading size="md" color="gray.800" fontWeight="semibold">
          Missions
        </Heading>
        <Text color="gray.400" mt={0.5} fontSize="xs">
          {missions.length} mission{missions.length !== 1 ? "s" : ""} in your
          organisation
        </Text>
      </Box>

      {/* Filter tabs */}
      <Flex gap={1} mb={6} overflowX="auto" pb={1}>
        {TABS.map((tab) => {
          const count = countFor(tab.key);
          const isActive = filter === tab.key;
          return (
            <Button
              key={tab.key}
              size="sm"
              variant={isActive ? "solid" : "ghost"}
              colorScheme={isActive ? "blue" : "gray"}
              onClick={() => setFilter(tab.key)}
              flexShrink={0}
              fontWeight={isActive ? "semibold" : "normal"}
              color={isActive ? undefined : "gray.600"}
            >
              {tab.label}
              {count > 0 && (
                <Text
                  as="span"
                  ml={1.5}
                  fontSize="xs"
                  fontWeight="normal"
                  opacity={isActive ? 0.8 : 0.6}
                >
                  {count}
                </Text>
              )}
            </Button>
          );
        })}
      </Flex>

      {/* Card grid */}
      {filtered.length === 0 ? (
        <Box
          bg="white"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          p={10}
          textAlign="center"
        >
          <Text fontSize="sm" color="gray.400">
            No{" "}
            {filter === "all"
              ? ""
              : filter.toLowerCase().replace("_", " ") + " "}
            missions found.
          </Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {filtered.map((mission) => (
            <MissionCard key={mission.id} mission={mission} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

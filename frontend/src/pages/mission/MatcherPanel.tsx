import { useEffect, useState } from "react";
import {
  Alert,
  AlertIcon,
  Box,
  Button,
  Divider,
  Flex,
  Spinner,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useMatcher, useAssignCrew } from "../../hooks/useMatcher";
import { MatcherRequirement } from "./MatcherRequirement";

interface Props {
  missionId: string;
}

export function MatcherPanel({ missionId }: Props) {
  const { data, isFetching, isError, error, refetch } = useMatcher(missionId);
  const assignMutation = useAssignCrew(missionId);

  const [hasRun, setHasRun] = useState(false);
  const [assigned, setAssigned] = useState(false);

  // requirementId → Set<userId>
  const [selections, setSelections] = useState<Map<string, Set<string>>>(
    new Map(),
  );

  // Pre-populate selections from algorithm suggestions when results arrive
  useEffect(() => {
    if (!data) return;
    const initial = new Map<string, Set<string>>();
    for (const req of data.requirements) {
      initial.set(
        req.requirementId,
        new Set(req.suggestions.filter((s) => s.assigned).map((s) => s.userId)),
      );
    }
    setSelections(initial);
  }, [data]);

  function handleRunMatcher() {
    setHasRun(true);
    setAssigned(false);
    refetch();
  }

  function toggle(requirementId: string, userId: string) {
    setSelections((prev) => {
      const next = new Map(prev);
      const current = new Set(next.get(requirementId) ?? []);
      if (current.has(userId)) {
        current.delete(userId);
      } else {
        // Remove from any other requirement first (a crew member can only fill one slot)
        for (const [reqId, users] of next.entries()) {
          if (reqId !== requirementId && users.has(userId)) {
            const updated = new Set(users);
            updated.delete(userId);
            next.set(reqId, updated);
          }
        }
        current.add(userId);
      }
      next.set(requirementId, current);
      return next;
    });
  }

  function handleConfirm() {
    const assignments = Array.from(selections.entries()).flatMap(
      ([requirementId, userIds]) =>
        Array.from(userIds).map((userId) => ({ userId, requirementId })),
    );
    assignMutation.mutate(assignments, {
      onSuccess: () => setAssigned(true),
    });
  }

  const totalSelected = Array.from(selections.values()).reduce(
    (sum, s) => sum + s.size,
    0,
  );

  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      p={5}
    >
      <Flex align="center" justify="space-between" mb={hasRun && data ? 5 : 0}>
        <Box>
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="gray.500"
            textTransform="uppercase"
            letterSpacing="wider"
          >
            Smart Matcher
          </Text>
          {!hasRun && (
            <Text fontSize="xs" color="gray.400" mt={0.5}>
              Automatically suggest crew based on skills, availability, and
              workload
            </Text>
          )}
        </Box>
        <Button
          size="sm"
          onClick={handleRunMatcher}
          isLoading={isFetching}
          loadingText="Running…"
          variant={hasRun && data ? "outline" : "solid"}
        >
          {hasRun && data ? "Re-run" : "Run Matcher"}
        </Button>
      </Flex>

      {/* Loading */}
      {isFetching && (
        <Flex justify="center" align="center" py={8} gap={3}>
          <Spinner size="sm" color="blue.500" />
          <Text fontSize="sm" color="gray.400">
            Analysing crew availability and skills…
          </Text>
        </Flex>
      )}

      {/* Error */}
      {isError && !isFetching && (
        <Alert status="error" borderRadius="md" mt={4} fontSize="sm">
          <AlertIcon />
          {error?.message ?? "Failed to run matcher"}
        </Alert>
      )}

      {/* Results */}
      {data && !isFetching && (
        <VStack spacing={4} align="stretch">
          {/* Summary */}
          {!data.fullyMatched && (
            <Alert status="warning" borderRadius="md" fontSize="sm">
              <AlertIcon />
              Some requirement slots could not be filled. You can still confirm
              a partial assignment.
            </Alert>
          )}

          {assigned && (
            <Alert status="success" borderRadius="md" fontSize="sm">
              <AlertIcon />
              Assignments confirmed. The mission detail has been updated.
            </Alert>
          )}

          {/* Requirement blocks */}
          {data.requirements.map((req) => (
            <MatcherRequirement
              key={req.requirementId}
              requirement={req}
              selected={selections.get(req.requirementId) ?? new Set()}
              onToggle={(userId) => toggle(req.requirementId, userId)}
            />
          ))}

          {data.requirements.length === 0 && (
            <Text fontSize="sm" color="gray.400">
              This mission has no requirements to match against.
            </Text>
          )}

          {/* Confirm row */}
          {data.requirements.length > 0 && (
            <>
              <Divider />
              <Flex align="center" justify="space-between">
                <Text fontSize="sm" color="gray.500">
                  {totalSelected} crew member{totalSelected !== 1 ? "s" : ""}{" "}
                  selected
                </Text>
                <Button
                  size="sm"
                  colorScheme="green"
                  onClick={handleConfirm}
                  isLoading={assignMutation.isPending}
                  loadingText="Saving…"
                  isDisabled={totalSelected === 0}
                >
                  Confirm Assignments
                </Button>
              </Flex>
            </>
          )}
        </VStack>
      )}
    </Box>
  );
}

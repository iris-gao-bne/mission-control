import { useState } from "react";
import {
  Badge,
  Box,
  Button,
  Divider,
  Flex,
  FormControl,
  FormLabel,
  Heading,
  Input,
  Modal,
  ModalBody,
  ModalCloseButton,
  ModalContent,
  ModalFooter,
  ModalHeader,
  ModalOverlay,
  SimpleGrid,
  Text,
  VStack,
  useDisclosure,
} from "@chakra-ui/react";
import { Link, useParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCrewMember } from "../hooks/useCrewMember";
import { useMissions } from "../hooks/useMissions";
import { useUpdateAssignmentStatus } from "../hooks/useUpdateAssignmentStatus";
import {
  useUpdateAvailability,
  type AvailabilityInput,
} from "../hooks/useUpdateAvailability";
import { PageSpinner } from "../components/PageSpinner";
import { PageError } from "../components/PageError";
import { StatusBadge } from "../components/StatusBadge";
import type { Availability, CrewMemberDetail, Mission } from "../types/api";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInput(iso: string) {
  return new Date(iso).toISOString().slice(0, 10);
}

function isActiveToday(start: string, end: string) {
  const now = Date.now();
  return new Date(start).getTime() <= now && new Date(end).getTime() >= now;
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: string }) {
  return (
    <Text
      fontSize="xs"
      fontWeight="semibold"
      color="gray.500"
      textTransform="uppercase"
      letterSpacing="wider"
      mb={4}
    >
      {children}
    </Text>
  );
}

// ─── Proficiency dots ─────────────────────────────────────────────────────────

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
        />
      ))}
    </Flex>
  );
}

// ─── Skills section ───────────────────────────────────────────────────────────

function SkillsSection({ member }: { member: CrewMemberDetail }) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      p={5}
    >
      <SectionLabel>Skills</SectionLabel>
      {member.skills.length === 0 ? (
        <Text fontSize="sm" color="gray.400">
          No skills on profile.
        </Text>
      ) : (
        <VStack spacing={3} align="stretch">
          {member.skills.map((cs) => (
            <Flex
              key={cs.skill.id}
              align="center"
              justify="space-between"
              gap={4}
            >
              <Box minW={0}>
                <Text
                  fontSize="sm"
                  fontWeight="medium"
                  color="gray.800"
                  noOfLines={1}
                >
                  {cs.skill.name}
                </Text>
                <Text fontSize="xs" color="gray.400">
                  {cs.skill.category}
                </Text>
              </Box>
              <Flex align="center" gap={2.5} flexShrink={0}>
                <ProficiencyDots level={cs.proficiencyLevel} />
                <Text fontSize="xs" color="gray.500" w={4} textAlign="right">
                  L{cs.proficiencyLevel}
                </Text>
              </Flex>
            </Flex>
          ))}
        </VStack>
      )}
    </Box>
  );
}

// ─── Availability section ─────────────────────────────────────────────────────

type WindowDraft = {
  id?: string;
  startDate: string;
  endDate: string;
  reason: string;
};

function AvailabilityModal({
  isOpen,
  onClose,
  crewId,
  existing,
}: {
  isOpen: boolean;
  onClose: () => void;
  crewId: string;
  existing: Availability[];
}) {
  const mutation = useUpdateAvailability();
  const [windows, setWindows] = useState<WindowDraft[]>(() =>
    existing.map((a) => ({
      id: a.id,
      startDate: toDateInput(a.startDate),
      endDate: toDateInput(a.endDate),
      reason: a.reason ?? "",
    })),
  );
  const [draft, setDraft] = useState({
    startDate: "",
    endDate: "",
    reason: "",
  });

  function addWindow() {
    if (!draft.startDate || !draft.endDate) return;
    setWindows((prev) => [...prev, { ...draft }]);
    setDraft({ startDate: "", endDate: "", reason: "" });
  }

  function removeWindow(idx: number) {
    setWindows((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleSave() {
    // If the user filled in dates but didn't click "+ Add window", include the draft automatically
    const pendingDraft: WindowDraft[] =
      draft.startDate &&
      draft.endDate &&
      new Date(draft.endDate) > new Date(draft.startDate)
        ? [draft]
        : [];

    const availability: AvailabilityInput[] = [...windows, ...pendingDraft].map(
      (w) => ({
        startDate: new Date(w.startDate).toISOString(),
        endDate: new Date(w.endDate).toISOString(),
        reason: w.reason || undefined,
      }),
    );
    mutation.mutate({ crewId, availability }, { onSuccess: onClose });
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader fontSize="md">Edit Leave & Blackout Windows</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            {/* Existing / queued windows */}
            {windows.length === 0 ? (
              <Text fontSize="sm" color="gray.400">
                No windows added.
              </Text>
            ) : (
              <VStack spacing={2} align="stretch">
                {windows.map((w, i) => (
                  <Flex
                    key={i}
                    align="center"
                    justify="space-between"
                    bg="gray.50"
                    borderRadius="md"
                    px={3}
                    py={2}
                    gap={3}
                  >
                    <Box>
                      <Text fontSize="sm" color="gray.700">
                        {w.startDate} → {w.endDate}
                      </Text>
                      {w.reason && (
                        <Text fontSize="xs" color="gray.400">
                          {w.reason}
                        </Text>
                      )}
                    </Box>
                    <Button
                      size="xs"
                      variant="ghost"
                      colorScheme="red"
                      onClick={() => removeWindow(i)}
                      flexShrink={0}
                    >
                      Remove
                    </Button>
                  </Flex>
                ))}
              </VStack>
            )}

            <Divider />

            {/* Add new window */}
            <Text
              fontSize="xs"
              fontWeight="semibold"
              color="gray.500"
              textTransform="uppercase"
              letterSpacing="wider"
            >
              Add window
            </Text>
            <SimpleGrid columns={2} spacing={3}>
              <FormControl>
                <FormLabel fontSize="xs">Start date</FormLabel>
                <Input
                  type="date"
                  size="sm"
                  value={draft.startDate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, startDate: e.target.value }))
                  }
                />
              </FormControl>
              <FormControl>
                <FormLabel fontSize="xs">End date</FormLabel>
                <Input
                  type="date"
                  size="sm"
                  value={draft.endDate}
                  min={draft.startDate}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, endDate: e.target.value }))
                  }
                />
              </FormControl>
            </SimpleGrid>
            <FormControl>
              <FormLabel fontSize="xs">Reason (optional)</FormLabel>
              <Input
                size="sm"
                placeholder="e.g. Annual Leave, Training Exercise"
                value={draft.reason}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, reason: e.target.value }))
                }
              />
            </FormControl>
            <Button
              size="sm"
              variant="outline"
              onClick={addWindow}
              isDisabled={
                !draft.startDate ||
                !draft.endDate ||
                new Date(draft.endDate) <= new Date(draft.startDate)
              }
              alignSelf="flex-start"
            >
              + Add window
            </Button>
          </VStack>
        </ModalBody>
        <ModalFooter gap={3}>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            isLoading={mutation.isPending}
            loadingText="Saving…"
          >
            Save changes
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function AvailabilitySection({
  member,
  isSelf,
}: {
  member: CrewMemberDetail;
  isSelf: boolean;
}) {
  const { isOpen, onOpen, onClose } = useDisclosure();

  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      p={5}
    >
      <Flex align="center" justify="space-between" mb={4}>
        <SectionLabel>Leave & Blackout Windows</SectionLabel>
        {isSelf && (
          <Button
            size="xs"
            variant="outline"
            colorScheme="gray"
            onClick={onOpen}
            mt={-4}
          >
            Edit
          </Button>
        )}
      </Flex>

      {member.availability.length === 0 ? (
        <Text fontSize="sm" color="gray.400">
          No leave or blackout windows recorded.
        </Text>
      ) : (
        <VStack spacing={0} align="stretch" divider={<Divider />}>
          {member.availability.map((a) => {
            const active = isActiveToday(a.startDate, a.endDate);
            return (
              <Flex
                key={a.id}
                align="center"
                justify="space-between"
                py={3}
                _first={{ pt: 0 }}
                _last={{ pb: 0 }}
                gap={4}
                flexWrap="wrap"
              >
                <Flex align="center" gap={2.5}>
                  {active && (
                    <Box
                      w={1.5}
                      h={1.5}
                      borderRadius="full"
                      bg="orange.400"
                      flexShrink={0}
                    />
                  )}
                  <Text fontSize="sm" color="gray.700">
                    {fmt(a.startDate)} – {fmt(a.endDate)}
                  </Text>
                </Flex>
                <Flex align="center" gap={2.5} flexShrink={0}>
                  {a.reason && (
                    <Text fontSize="xs" color="gray.400">
                      {a.reason}
                    </Text>
                  )}
                  {active && (
                    <Badge
                      colorScheme="orange"
                      variant="subtle"
                      borderRadius="full"
                      px={2}
                      fontSize="xs"
                    >
                      Active now
                    </Badge>
                  )}
                </Flex>
              </Flex>
            );
          })}
        </VStack>
      )}

      <AvailabilityModal
        isOpen={isOpen}
        onClose={onClose}
        crewId={member.id}
        existing={member.availability}
      />
    </Box>
  );
}

// ─── Missions section ─────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  DECLINED: "Declined",
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: "gray",
  CONFIRMED: "green",
  DECLINED: "red",
};

function MissionsSection({
  missions,
  memberId,
  isSelf,
}: {
  missions: Mission[];
  memberId: string;
  isSelf: boolean;
}) {
  const mutation = useUpdateAssignmentStatus();
  const assigned = missions.filter((m) =>
    m.assignments.some((a) => a.user.id === memberId),
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
      <SectionLabel>Assigned Missions</SectionLabel>
      {assigned.length === 0 ? (
        <Text fontSize="sm" color="gray.400">
          No mission assignments.
        </Text>
      ) : (
        <VStack spacing={0} align="stretch" divider={<Divider />}>
          {assigned.map((m) => {
            const myAssignment = m.assignments.find(
              (a) => a.user.id === memberId,
            );
            if (!myAssignment) return null;
            const currentStatus = myAssignment.status;
            const isUpdating =
              mutation.isPending &&
              mutation.variables?.assignmentId === myAssignment.id;

            return (
              <Box key={m.id} py={3} _first={{ pt: 0 }} _last={{ pb: 0 }}>
                <Flex
                  align="center"
                  justify="space-between"
                  gap={4}
                  flexWrap="wrap"
                  mb={isSelf ? 2.5 : 0}
                >
                  <Text
                    as={Link}
                    to={`/missions/${m.id}`}
                    fontSize="sm"
                    fontWeight="medium"
                    color="gray.800"
                    noOfLines={1}
                    flex={1}
                    _hover={{ color: "blue.500" }}
                  >
                    {m.name}
                  </Text>
                  <Flex align="center" gap={2.5} flexShrink={0}>
                    <Text fontSize="xs" color="gray.400">
                      {fmt(m.startDate)} – {fmt(m.endDate)}
                    </Text>
                    <StatusBadge status={m.status} />
                  </Flex>
                </Flex>

                {/* Assignment status + actions — crew member only */}
                {isSelf && (
                  <Flex align="center" gap={2.5}>
                    <Badge
                      colorScheme={STATUS_COLOR[currentStatus]}
                      variant="subtle"
                      borderRadius="full"
                      px={2}
                      fontSize="xs"
                    >
                      {STATUS_LABEL[currentStatus]}
                    </Badge>

                    {currentStatus !== "CONFIRMED" && (
                      <Button
                        size="xs"
                        colorScheme="green"
                        variant="outline"
                        isLoading={isUpdating}
                        onClick={() =>
                          mutation.mutate({
                            crewId: memberId,
                            assignmentId: myAssignment.id,
                            status: "CONFIRMED",
                          })
                        }
                      >
                        Confirm
                      </Button>
                    )}
                    {currentStatus !== "DECLINED" && (
                      <Button
                        size="xs"
                        colorScheme="red"
                        variant="outline"
                        isLoading={isUpdating}
                        onClick={() =>
                          mutation.mutate({
                            crewId: memberId,
                            assignmentId: myAssignment.id,
                            status: "DECLINED",
                          })
                        }
                      >
                        Decline
                      </Button>
                    )}
                  </Flex>
                )}
              </Box>
            );
          })}
        </VStack>
      )}
    </Box>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  DIRECTOR: "Director",
  MISSION_LEAD: "Mission Lead",
  CREW_MEMBER: "Crew Member",
};

export function CrewDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    data: member,
    isLoading: memberLoading,
    isError,
    error,
    refetch,
  } = useCrewMember(id ?? "");
  const { data: missions = [], isLoading: missionsLoading } = useMissions();

  if (memberLoading || missionsLoading) return <PageSpinner />;
  if (isError) return <PageError message={error?.message} onRetry={refetch} />;
  if (!member) return null;

  const isSelf = user?.id === member.id;

  return (
    <VStack spacing={5} align="stretch">
      <Box>
        <Text
          as={Link}
          to="/crew"
          fontSize="xs"
          color="gray.400"
          _hover={{ color: "blue.500" }}
          display="inline-flex"
          alignItems="center"
          gap={1}
          mb={4}
        >
          ← Crew
        </Text>

        <Flex align="center" gap={4} flexWrap="wrap">
          <Flex
            w={14}
            h={14}
            borderRadius="full"
            bg="blue.700"
            align="center"
            justify="center"
            flexShrink={0}
          >
            <Text fontSize="lg" fontWeight="bold" color="white">
              {initials(member.name)}
            </Text>
          </Flex>
          <Box>
            <Heading
              size="lg"
              color="gray.800"
              fontWeight="semibold"
              lineHeight="short"
            >
              {member.name}
            </Heading>
            <Text fontSize="sm" color="gray.400" mt={0.5}>
              {member.email}
            </Text>
          </Box>
          <Badge
            colorScheme="blue"
            variant="subtle"
            borderRadius="full"
            px={3}
            py={1}
            fontSize="xs"
            ml="auto"
          >
            {ROLE_LABEL[member.role] ?? member.role}
          </Badge>
        </Flex>
      </Box>

      <SimpleGrid columns={{ base: 1, lg: 2 }} spacing={5} alignItems="start">
        <SkillsSection member={member} />
        <AvailabilitySection member={member} isSelf={isSelf} />
      </SimpleGrid>

      <MissionsSection
        missions={missions}
        memberId={member.id}
        isSelf={isSelf}
      />
    </VStack>
  );
}

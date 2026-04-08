import { VStack } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { useMission } from "../hooks/useMission";
import { useAuth } from "../context/AuthContext";
import { PageSpinner } from "../components/PageSpinner";
import { PageError } from "../components/PageError";
import { MissionHeader } from "./mission/MissionHeader";
import { MissionOverview } from "./mission/MissionOverview";
import { RejectionReason } from "./mission/RejectionReason";
import { RequirementsList } from "./mission/RequirementsList";
import { MatcherPanel } from "./mission/MatcherPanel";

export function MissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const {
    data: mission,
    isLoading,
    isError,
    error,
    refetch,
  } = useMission(id ?? "");

  if (isLoading) return <PageSpinner />;
  if (isError) return <PageError message={error?.message} onRetry={refetch} />;
  if (!mission) return null;

  const canRunMatcher =
    mission.status === "APPROVED" &&
    (user?.role === "DIRECTOR" || user?.role === "MISSION_LEAD");

  return (
    <VStack spacing={5} align="stretch">
      <MissionHeader mission={mission} />
      {mission.status === "REJECTED" && (
        <RejectionReason reason={mission.rejectionReason} />
      )}
      <MissionOverview mission={mission} />
      <RequirementsList mission={mission} />
      {canRunMatcher && <MatcherPanel missionId={mission.id} />}
    </VStack>
  );
}

import { VStack } from "@chakra-ui/react";
import { useParams } from "react-router-dom";
import { useMission } from "../hooks/useMission";
import { PageSpinner } from "../components/PageSpinner";
import { PageError } from "../components/PageError";
import { MissionHeader } from "./mission/MissionHeader";
import { MissionOverview } from "./mission/MissionOverview";
import { RejectionReason } from "./mission/RejectionReason";
import { RequirementsList } from "./mission/RequirementsList";

export function MissionDetail() {
  const { id } = useParams<{ id: string }>();
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

  return (
    <VStack spacing={5} align="stretch">
      <MissionHeader mission={mission} />
      {mission.status === "REJECTED" && (
        <RejectionReason reason={mission.rejectionReason} />
      )}
      <MissionOverview mission={mission} />
      <RequirementsList mission={mission} />
    </VStack>
  );
}

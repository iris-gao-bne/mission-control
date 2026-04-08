import { VStack } from "@chakra-ui/react";
import { NextMissionBanner } from "./NextMissionBanner";
import { MyMissionsList } from "./MyMissionsList";
import type { CrewDashboardData } from "../../types/api";

interface Props {
  data: CrewDashboardData;
}

export function CrewDashboard({ data }: Props) {
  return (
    <VStack spacing={6} align="stretch">
      <NextMissionBanner mission={data.myNextMission} />
      <MyMissionsList missions={data.myMissions} />
    </VStack>
  );
}

import { Grid, VStack } from '@chakra-ui/react'
import { MissionPipeline } from './MissionPipeline'
import { CrewSnapshot } from './CrewSnapshot'
import { PendingApprovals } from './PendingApprovals'
import { UpcomingMissions } from './UpcomingMissions'
import type { OrgDashboardData, Role } from '../../types/api'

interface Props {
  data: OrgDashboardData
  role: Role
}

export function OrgDashboard({ data, role }: Props) {
  const isDirector = role === 'DIRECTOR'

  return (
    <VStack spacing={4} align="stretch">
      {/* Pipeline — full width KPI strip */}
      <MissionPipeline missionsByStatus={data.missionsByStatus} />

      {/* Two-column section */}
      <Grid templateColumns={{ base: '1fr', lg: '1fr 1fr' }} gap={4}>
        <CrewSnapshot crew={data.crew} missionsNeedingCrew={data.missionsNeedingCrew} />

        {isDirector && data.pendingApprovals !== undefined ? (
          <PendingApprovals approvals={data.pendingApprovals} />
        ) : (
          <UpcomingMissions missions={data.upcomingMissions} />
        )}
      </Grid>

      {/* Upcoming missions — full width for directors only (leads already have it above) */}
      {isDirector && <UpcomingMissions missions={data.upcomingMissions} />}
    </VStack>
  )
}

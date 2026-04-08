import { Box, Heading, Text } from "@chakra-ui/react";
import { useAuth } from "../context/AuthContext";
import { useDashboard } from "../hooks/useDashboard";
import { PageSpinner } from "../components/PageSpinner";
import { PageError } from "../components/PageError";
import { isOrgDashboard, isCrewDashboard } from "../types/api";
import { OrgDashboard } from "./dashboard/OrgDashboard";
import { CrewDashboard } from "./dashboard/CrewDashboard";

export function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useDashboard();

  if (isLoading) return <PageSpinner />;
  if (isError) return <PageError message={error?.message} onRetry={refetch} />;

  return (
    <Box>
      <Box mb={6}>
        <Heading size="md" color="gray.800" fontWeight="semibold">
          Welcome back, {user?.name.split(" ")[0]}
        </Heading>
        <Text color="gray.400" mt={0.5} fontSize="xs">
          {user?.orgName} ·{" "}
          {new Date().toLocaleDateString("en-AU", {
            weekday: "long",
            day: "numeric",
            month: "long",
          })}
        </Text>
      </Box>

      {data && isOrgDashboard(data) && user && (
        <OrgDashboard data={data} role={user.role} />
      )}

      {data && isCrewDashboard(data) && <CrewDashboard data={data} />}
    </Box>
  );
}

import { Box, Heading, SimpleGrid, Text } from "@chakra-ui/react";
import { useCrew } from "../hooks/useCrew";
import { PageSpinner } from "../components/PageSpinner";
import { PageError } from "../components/PageError";
import { CrewCard } from "./crew/CrewCard";

export function Crew() {
  const { data: crew = [], isLoading, isError, error, refetch } = useCrew();

  if (isLoading) return <PageSpinner />;
  if (isError) return <PageError message={error?.message} onRetry={refetch} />;

  return (
    <Box>
      <Box mb={6}>
        <Heading size="md" color="gray.800" fontWeight="semibold">
          Crew Roster
        </Heading>
        <Text color="gray.400" mt={0.5} fontSize="xs">
          {crew.length} crew member{crew.length !== 1 ? "s" : ""} in your
          organisation
        </Text>
      </Box>

      {crew.length === 0 ? (
        <Box
          bg="white"
          borderRadius="lg"
          border="1px solid"
          borderColor="gray.200"
          p={10}
          textAlign="center"
        >
          <Text fontSize="sm" color="gray.400">
            No crew members found.
          </Text>
        </Box>
      ) : (
        <SimpleGrid columns={{ base: 1, md: 2, xl: 3 }} spacing={4}>
          {crew.map((member) => (
            <CrewCard key={member.id} member={member} />
          ))}
        </SimpleGrid>
      )}
    </Box>
  );
}

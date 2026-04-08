import { Fragment } from "react";
import { Badge, Box, Flex, Progress, Text } from "@chakra-ui/react";
import type { Mission } from "../../types/api";

interface Props {
  mission: Mission;
}

export function CardFooter({ mission }: Props) {
  const { requirements, assignments, status } = mission;

  const totalHeadcount = requirements.reduce((sum, r) => sum + r.headcount, 0);
  const totalAssigned = assignments.length;
  const unfilled = Math.max(0, totalHeadcount - totalAssigned);
  const fillPct =
    totalHeadcount > 0 ? (totalAssigned / totalHeadcount) * 100 : 0;
  const isFull = unfilled === 0 && totalHeadcount > 0;

  const skillNames = requirements.map((r) => r.skill.name);
  const displaySkills = skillNames.slice(0, 2);
  const extraSkills = skillNames.length - 2;

  if (status === "REJECTED" && mission.rejectionReason) {
    return (
      <Box borderTop="1px solid" borderColor="gray.100" pt={3} mt={3}>
        <Text fontSize="xs" color="red.500" fontStyle="italic" noOfLines={2}>
          ✗ "{mission.rejectionReason}"
        </Text>
      </Box>
    );
  }

  if (requirements.length === 0) {
    return (
      <Box borderTop="1px solid" borderColor="gray.100" pt={3} mt={3}>
        <Text fontSize="xs" color="gray.400">
          No requirements defined yet
        </Text>
      </Box>
    );
  }

  return (
    <Box borderTop="1px solid" borderColor="gray.100" pt={3} mt={3}>
      <Flex align="center" justify="space-between" mb={1.5}>
        <Text fontSize="xs" color="gray.500">
          {totalAssigned} / {totalHeadcount} crew assigned
        </Text>
        {unfilled > 0 && (
          <Badge
            colorScheme="orange"
            variant="subtle"
            borderRadius="full"
            px={2}
            fontSize="xs"
          >
            {unfilled} unfilled
          </Badge>
        )}
        {isFull && (
          <Badge
            colorScheme="green"
            variant="subtle"
            borderRadius="full"
            px={2}
            fontSize="xs"
          >
            Fully staffed
          </Badge>
        )}
      </Flex>

      <Progress
        value={fillPct}
        size="xs"
        borderRadius="full"
        colorScheme={isFull ? "green" : totalAssigned > 0 ? "blue" : "gray"}
        bg="gray.100"
        mb={3}
      />

      <Flex align="center" gap={1} flexWrap="wrap">
        {displaySkills.map((name, i) => (
          <Fragment key={name}>
            {i > 0 && (
              <Text fontSize="xs" color="gray.300" mx={0.5}>
                ·
              </Text>
            )}
            <Text fontSize="xs" color="gray.500">
              {name}
            </Text>
          </Fragment>
        ))}
        {extraSkills > 0 && (
          <>
            <Text fontSize="xs" color="gray.300" mx={0.5}>
              ·
            </Text>
            <Text fontSize="xs" color="gray.400">
              +{extraSkills} more
            </Text>
          </>
        )}
      </Flex>
    </Box>
  );
}

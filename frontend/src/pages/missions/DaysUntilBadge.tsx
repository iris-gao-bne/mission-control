import { Text } from "@chakra-ui/react";
import type { MissionStatus } from "../../types/api";

interface Props {
  startDate: string;
  endDate: string;
  status: MissionStatus;
}

export function DaysUntilBadge({ startDate, endDate, status }: Props) {
  const now = Date.now();
  const msPerDay = 1000 * 60 * 60 * 24;

  if (status === "IN_PROGRESS") {
    const daysLeft = Math.ceil((new Date(endDate).getTime() - now) / msPerDay);
    if (daysLeft < 0) return null;
    return (
      <Text fontSize="xs" color="blue.500" fontWeight="medium">
        {daysLeft === 0 ? "Ends today" : `Ends in ${daysLeft}d`}
      </Text>
    );
  }

  if (status === "DRAFT" || status === "SUBMITTED" || status === "APPROVED") {
    const daysUntil = Math.ceil(
      (new Date(startDate).getTime() - now) / msPerDay,
    );
    if (daysUntil < 0) return null;
    const color =
      daysUntil <= 7
        ? "orange.500"
        : daysUntil <= 30
          ? "yellow.600"
          : "gray.400";
    return (
      <Text fontSize="xs" color={color} fontWeight="medium">
        {daysUntil === 0 ? "Starts today" : `Starts in ${daysUntil}d`}
      </Text>
    );
  }

  return null;
}

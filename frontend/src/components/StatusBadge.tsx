import { Badge } from "@chakra-ui/react";
import type { MissionStatus } from "../types/api";

const COLOR: Record<MissionStatus, string> = {
  DRAFT: "gray",
  SUBMITTED: "yellow",
  APPROVED: "green",
  REJECTED: "red",
  IN_PROGRESS: "blue",
  COMPLETED: "teal",
  CANCELLED: "orange",
};

const LABEL: Record<MissionStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

interface Props {
  status: MissionStatus;
  size?: "sm" | "md";
}

export function StatusBadge({ status, size = "sm" }: Props) {
  return (
    <Badge
      colorScheme={COLOR[status]}
      variant="subtle"
      borderRadius="full"
      px={size === "md" ? 3 : 2}
      py={size === "md" ? 1 : 0.5}
      fontSize={size === "md" ? "sm" : "xs"}
      fontWeight="semibold"
    >
      {LABEL[status]}
    </Badge>
  );
}

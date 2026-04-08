import {
  Alert,
  AlertDescription,
  AlertIcon,
  AlertTitle,
} from "@chakra-ui/react";

interface Props {
  reason: string | null;
}

export function RejectionReason({ reason }: Props) {
  return (
    <Alert status="error" borderRadius="lg" alignItems="flex-start" gap={2}>
      <AlertIcon mt={0.5} />
      <div>
        <AlertTitle fontSize="sm">Mission rejected</AlertTitle>
        <AlertDescription fontSize="sm" color="red.700">
          {reason ?? "No reason provided."}
        </AlertDescription>
      </div>
    </Alert>
  );
}

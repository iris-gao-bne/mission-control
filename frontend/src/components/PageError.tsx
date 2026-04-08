import { Alert, AlertDescription, AlertIcon, AlertTitle, Button, VStack } from '@chakra-ui/react'

interface Props {
  message?: string
  onRetry?: () => void
}

export function PageError({ message = 'Something went wrong.', onRetry }: Props) {
  return (
    <VStack align="stretch" spacing={4} maxW="480px" mx="auto" mt={12}>
      <Alert status="error" borderRadius="lg" flexDirection="column" alignItems="flex-start" gap={1}>
        <AlertIcon />
        <AlertTitle>Failed to load</AlertTitle>
        <AlertDescription fontSize="sm">{message}</AlertDescription>
      </Alert>
      {onRetry && (
        <Button size="sm" variant="outline" onClick={onRetry} alignSelf="flex-start">
          Try again
        </Button>
      )}
    </VStack>
  )
}

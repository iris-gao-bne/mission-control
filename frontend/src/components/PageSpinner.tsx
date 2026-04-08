import { Flex, Spinner, Text, VStack } from '@chakra-ui/react'

export function PageSpinner() {
  return (
    <Flex minH="40vh" align="center" justify="center">
      <VStack spacing={3}>
        <Spinner size="lg" color="blue.500" thickness="3px" />
        <Text fontSize="sm" color="gray.400">Loading…</Text>
      </VStack>
    </Flex>
  )
}

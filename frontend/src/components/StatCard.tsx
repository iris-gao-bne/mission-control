import { Box, Text } from '@chakra-ui/react'

interface Props {
  label: string
  value: number | string
  helpText?: string
  accent?: string   // Chakra color token e.g. 'blue.500'
}

export function StatCard({ label, value, helpText, accent }: Props) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
      p={5}
    >
      <Text
        fontSize="xs"
        fontWeight="semibold"
        color="gray.500"
        textTransform="uppercase"
        letterSpacing="wider"
        mb={2}
      >
        {label}
      </Text>
      <Text fontSize="3xl" fontWeight="bold" color={accent ?? 'gray.800'} lineHeight={1}>
        {value}
      </Text>
      {helpText && (
        <Text fontSize="xs" color="gray.400" mt={2}>
          {helpText}
        </Text>
      )}
    </Box>
  )
}

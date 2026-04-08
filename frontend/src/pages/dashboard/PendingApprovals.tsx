import { Badge, Box, Divider, Flex, Text } from '@chakra-ui/react'
import type { PendingApproval } from '../../types/api'

interface Props {
  approvals: PendingApproval[]
}

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

export function PendingApprovals({ approvals }: Props) {
  return (
    <Box
      bg="white"
      borderRadius="lg"
      border="1px solid"
      borderColor="gray.200"
      boxShadow="sm"
    >
      <Flex align="center" gap={2.5} px={5} py={4}>
        <Text fontSize="xs" fontWeight="semibold" color="gray.500" textTransform="uppercase" letterSpacing="wider">
          Pending Approvals
        </Text>
        <Badge colorScheme="orange" borderRadius="full" px={2} fontSize="xs">
          {approvals.length}
        </Badge>
      </Flex>

      {approvals.length === 0 ? (
        <Box px={5} pb={5}>
          <Text fontSize="sm" color="gray.400">No missions awaiting approval.</Text>
        </Box>
      ) : (
        <>
          <Divider />
          {approvals.map((a, i) => (
            <Box key={a.id}>
              <Box
                px={5}
                py={3}
                _hover={{ bg: 'gray.50' }}
                transition="background 0.1s"
              >
                <Text fontSize="sm" fontWeight="medium" color="gray.800" noOfLines={1}>
                  {a.name}
                </Text>
                <Text fontSize="xs" color="gray.400" mt={0.5}>
                  {a.createdBy.name} · {fmt(a.startDate)} – {fmt(a.endDate)}
                </Text>
              </Box>
              {i < approvals.length - 1 && <Divider />}
            </Box>
          ))}
        </>
      )}
    </Box>
  )
}

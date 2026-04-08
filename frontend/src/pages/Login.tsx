import {
  Box,
  Button,
  Flex,
  FormControl,
  FormErrorMessage,
  FormLabel,
  Heading,
  Input,
  Text,
  VStack,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { useLoginMutation } from "../hooks/useAuth";

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const queryClient = useQueryClient();
  const loginMutation = useLoginMutation();

  const [slug, setSlug] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const slugError =
    slug.trim() === "" && slug !== "" ? "Organisation slug is required" : "";
  const emailError =
    email !== "" && !email.includes("@") ? "Enter a valid email" : "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    loginMutation.mutate(
      { slug: slug.trim(), email: email.trim(), password },
      {
        onSuccess: (response) => {
          queryClient.clear();
          login(response);
          navigate("/dashboard", { replace: true });
        },
      },
    );
  }

  return (
    <Flex minH="100vh">
      {/* Left panel — branding */}
      <Flex
        display={{ base: "none", md: "flex" }}
        direction="column"
        justify="center"
        align="flex-start"
        w="45%"
        px={16}
        bgGradient="linear(to-br, gray.900, blue.900)"
        color="white"
      >
        <Text fontSize="3xl" mb={3}>
          🚀
        </Text>
        <Heading size="xl" mb={3} lineHeight="shorter">
          Mission Control
        </Heading>
        <Text color="blue.200" fontSize="md" maxW="320px" lineHeight="tall">
          Plan missions, match the right crew, and keep every launch on track.
        </Text>
      </Flex>

      {/* Right panel — form */}
      <Flex
        flex={1}
        align="center"
        justify="center"
        bg="gray.50"
        px={{ base: 6, md: 12 }}
      >
        <Box w="full" maxW="400px">
          {/* Mobile brand */}
          <Box
            display={{ base: "block", md: "none" }}
            mb={8}
            textAlign="center"
          >
            <Text fontSize="2xl">🚀</Text>
            <Heading size="lg" mt={1}>
              Mission Control
            </Heading>
          </Box>

          <Box
            bg="white"
            borderRadius="xl"
            boxShadow="lg"
            border="1px solid"
            borderColor="gray.200"
            p={8}
          >
            <VStack spacing={6} align="stretch">
              <Box>
                <Heading size="md" color="gray.800">
                  Sign in
                </Heading>
                <Text color="gray.500" fontSize="sm" mt={1}>
                  Enter your organisation and credentials
                </Text>
              </Box>

              {loginMutation.isError && (
                <Alert status="error" borderRadius="md" fontSize="sm">
                  <AlertIcon />
                  {loginMutation.error.message}
                </Alert>
              )}

              <form onSubmit={handleSubmit}>
                <VStack spacing={4}>
                  <FormControl isRequired isInvalid={!!slugError}>
                    <FormLabel fontSize="sm">Organisation slug</FormLabel>
                    <Input
                      placeholder="e.g. artemis"
                      value={slug}
                      onChange={(e) => setSlug(e.target.value)}
                      autoComplete="organization"
                      bg="gray.50"
                    />
                    <FormErrorMessage>{slugError}</FormErrorMessage>
                  </FormControl>

                  <FormControl isRequired isInvalid={!!emailError}>
                    <FormLabel fontSize="sm">Email</FormLabel>
                    <Input
                      type="email"
                      placeholder="you@org.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      bg="gray.50"
                    />
                    <FormErrorMessage>{emailError}</FormErrorMessage>
                  </FormControl>

                  <FormControl isRequired>
                    <FormLabel fontSize="sm">Password</FormLabel>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      bg="gray.50"
                    />
                  </FormControl>

                  <Button
                    type="submit"
                    w="full"
                    mt={2}
                    isLoading={loginMutation.isPending}
                    loadingText="Signing in…"
                  >
                    Sign in
                  </Button>
                </VStack>
              </form>
            </VStack>
          </Box>
        </Box>
      </Flex>
    </Flex>
  );
}

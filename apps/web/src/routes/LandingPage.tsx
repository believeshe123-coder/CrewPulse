import { Badge, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useQuery } from '@tanstack/react-query';

import { fetchHealth } from '../lib/api';

export const LandingPage = () => {
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });

  return (
    <Flex minHeight="100vh" align="center" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 520 }}>
        <Flex direction="column" gap="4">
          <Heading size="7">CrewPulse</Heading>
          <Text color="gray">Monorepo baseline is running.</Text>

          {healthQuery.isPending && <Badge color="gray">Checking API health...</Badge>}

          {healthQuery.isError && <Badge color="red">API unavailable</Badge>}

          {healthQuery.data && (
            <Flex direction="column" gap="1">
              <Badge color="green">API healthy</Badge>
              <Text size="2">Service: {healthQuery.data.service}</Text>
              <Text size="2">Status: {healthQuery.data.status}</Text>
            </Flex>
          )}
        </Flex>
      </Card>
    </Flex>
  );
};

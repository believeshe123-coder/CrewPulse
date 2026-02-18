import { Badge, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { readAuthState } from '../lib/auth';
import { fetchWorkerAnalytics } from '../lib/api';

export const WorkerAnalyticsPage = () => {
  const params = useParams();
  const auth = readAuthState();

  const query = useQuery({
    queryKey: ['worker-analytics', params.id],
    queryFn: async () => {
      if (!auth || !params.id) {
        throw new Error('Missing auth or worker id');
      }

      const response = await fetchWorkerAnalytics(params.id, auth);

      if (!response.ok) {
        throw new Error(`Analytics request failed with ${response.status}`);
      }

      return response.json() as Promise<{ productivityScore: number; attendanceScore: number; flags: string[] }>;
    },
    retry: false,
  });

  return (
    <Flex minHeight="100vh" align="center" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 520 }}>
        <Heading size="6">Worker analytics</Heading>
        {query.isPending && <Badge color="gray">Loading...</Badge>}
        {query.isError && <Badge color="red">Unable to load analytics.</Badge>}
        {query.data && (
          <Flex direction="column" gap="1" mt="3">
            <Text>Productivity: {query.data.productivityScore}</Text>
            <Text>Attendance: {query.data.attendanceScore}</Text>
            <Text>Flags: {query.data.flags.join(', ')}</Text>
          </Flex>
        )}
      </Card>
    </Flex>
  );
};

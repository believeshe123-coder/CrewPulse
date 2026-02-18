import { Badge, Button, Card, Flex, Heading, Text } from '@radix-ui/themes';
import { useMutation } from '@tanstack/react-query';
import { useParams } from 'react-router-dom';

import { readAuthState } from '../lib/auth';
import { submitAssignmentRating } from '../lib/api';

export const AssignmentRatingPage = () => {
  const params = useParams();
  const auth = readAuthState();

  const ratingMutation = useMutation({
    mutationFn: async () => {
      if (!auth || !params.id) {
        throw new Error('Missing auth or assignment id');
      }

      const response = await submitAssignmentRating(params.id, auth, 5);

      if (!response.ok) {
        throw new Error(`Rating failed with ${response.status}`);
      }

      return response.json() as Promise<{ status: string }>;
    },
  });

  return (
    <Flex minHeight="100vh" align="center" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 520 }}>
        <Heading size="6">Assignment customer rating</Heading>
        <Text size="2" color="gray">
          Submits a sample 5-star rating for assignment {params.id}.
        </Text>
        <Flex mt="3">
          <Button onClick={() => ratingMutation.mutate()}>Submit rating</Button>
        </Flex>
        {ratingMutation.isSuccess && <Badge color="green">Rating submitted.</Badge>}
        {ratingMutation.isError && <Badge color="red">Not allowed to submit rating.</Badge>}
      </Card>
    </Flex>
  );
};

import { Badge, Card, Flex, Grid, Heading, Link, Text } from '@radix-ui/themes';

import { readAuthState } from '../lib/auth';

const roleGroupMap: Record<string, string[]> = {
  staff: ['Operations', 'Field Staffing', 'Safety Reviews'],
  moderator: ['User Provisioning', 'Access Governance'],
};

export const PostLoginHomePage = () => {
  const auth = readAuthState();
  const joinedGroups = auth ? roleGroupMap[auth.role] ?? [] : [];

  return (
    <Flex minHeight="100vh" direction="column" p="6" gap="4">
      <Card size="3">
        <Flex direction="column" gap="3">
          <Badge color="green" variant="soft" style={{ width: 'fit-content' }}>
            Signed In
          </Badge>
          <Heading size="7">Home</Heading>
          <Text color="gray">Your joined groups are listed below.</Text>
        </Flex>
      </Card>

      <Grid columns={{ initial: '1', sm: '2', lg: '3' }} gap="3">
        {joinedGroups.map((groupName) => (
          <Card key={groupName}>
            <Flex direction="column" gap="2">
              <Heading size="4">{groupName}</Heading>
              <Text color="gray" size="2">
                Group membership enabled for your current role.
              </Text>
            </Flex>
          </Card>
        ))}
      </Grid>

      {auth?.role === 'staff' ? (
        <Link href="/staff/dashboard">Open staff dashboard</Link>
      ) : auth?.role === 'moderator' ? (
        <Link href="/assignments">Open assignments</Link>
      ) : (
        <Link href="/">Back to landing</Link>
      )}
    </Flex>
  );
};

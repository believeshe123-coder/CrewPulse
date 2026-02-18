import { Badge, Card, Flex, Heading, Link, Text } from '@radix-ui/themes';

export const WorkerHomePage = () => {
  return (
    <Flex minHeight="100vh" align="center" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 720 }}>
        <Flex direction="column" gap="3">
          <Badge color="indigo" variant="soft" style={{ width: 'fit-content' }}>
            Worker Portal
          </Badge>
          <Heading size="6">Welcome, worker</Heading>
          <Text color="gray">
            You are logged in as a worker. This route acts as a safe worker landing page.
          </Text>
          <Link href="/">Back to landing</Link>
        </Flex>
      </Card>
    </Flex>
  );
};

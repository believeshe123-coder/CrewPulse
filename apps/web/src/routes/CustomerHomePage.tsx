import { Badge, Card, Flex, Heading, Link, Text } from '@radix-ui/themes';

export const CustomerHomePage = () => {
  return (
    <Flex minHeight="100vh" align="center" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 720 }}>
        <Flex direction="column" gap="3">
          <Badge color="blue" variant="soft" style={{ width: 'fit-content' }}>
            Customer Portal
          </Badge>
          <Heading size="6">Welcome, customer</Heading>
          <Text color="gray">
            You are logged in as a customer. Customer-specific flows can start here.
          </Text>
          <Text size="2" color="gray">
            To rate an assignment directly, open a customer rating URL with an assignment id.
          </Text>
          <Link href="/">Back to landing</Link>
        </Flex>
      </Card>
    </Flex>
  );
};

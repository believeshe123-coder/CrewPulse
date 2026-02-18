import { Badge, Button, Card, Flex, Grid, Heading, Text } from '@radix-ui/themes';

export const LandingPage = () => {
  const dashboardSections = [
    {
      title: 'Top Performers',
      tone: 'green' as const,
      description: 'High-scoring workers by category will appear here.',
    },
    {
      title: 'Needs Review',
      tone: 'yellow' as const,
      description: 'Workers showing decline or low category scores.',
    },
    {
      title: 'NCNS Risk',
      tone: 'orange' as const,
      description: 'Attendance patterns with elevated no-call-no-show risk.',
    },
    {
      title: 'Chronic Late',
      tone: 'red' as const,
      description: 'Workers with repeat late-arrival behavior.',
    },
  ];

  return (
    <Flex minHeight="100vh" direction="column" p="6" gap="5">
      <Card size="3">
        <Flex direction="column" gap="4">
          <Heading size="8">CrewPulse</Heading>
          <Text color="gray">Workforce intelligence dashboard (MVP frontend placeholder).</Text>

          <Flex gap="2" wrap="wrap">
            <Button variant="solid">Login as Staff</Button>
            <Button variant="soft">Login as Customer</Button>
            <Button variant="soft">Login as Worker</Button>
          </Flex>

          <Text size="2" color="gray">
            Authentication wiring is intentionally placeholder-only for this first route.
          </Text>
        </Flex>
      </Card>

      <Grid columns={{ initial: '1', sm: '2', lg: '4' }} gap="3">
        {dashboardSections.map((section) => (
          <Card key={section.title} size="3">
            <Flex direction="column" gap="3">
              <Badge color={section.tone} variant="soft" style={{ width: 'fit-content' }}>
                Dashboard Section
              </Badge>
              <Heading size="4">{section.title}</Heading>
              <Text size="2" color="gray">
                {section.description}
              </Text>
            </Flex>
          </Card>
        ))}
      </Grid>
    </Flex>
  );
};

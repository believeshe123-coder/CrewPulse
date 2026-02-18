import { useState } from 'react';
import { Badge, Button, Card, Flex, Grid, Heading, Text } from '@radix-ui/themes';
import { useNavigate } from 'react-router-dom';

import { writeAuthState } from '../lib/auth';
import { login } from '../lib/api';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [pendingRole, setPendingRole] = useState<null | 'staff' | 'customer' | 'worker'>(null);
  const [loginError, setLoginError] = useState<string | null>(null);

  const loginAsRole = async ({
    role,
    seedUserId,
    targetPath,
  }: {
    role: 'staff' | 'customer' | 'worker';
    seedUserId: string;
    targetPath: string;
  }) => {
    setLoginError(null);
    setPendingRole(role);

    try {
      const nextAuth = await login(seedUserId);
      writeAuthState(nextAuth);
      navigate(targetPath);
    } catch {
      setLoginError(`Unable to login as ${role}. Please try again.`);
    } finally {
      setPendingRole(null);
    }
  };

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
            <Button
              variant="solid"
              disabled={pendingRole !== null}
              loading={pendingRole === 'staff'}
              onClick={() =>
                void loginAsRole({
                  role: 'staff',
                  seedUserId: 'staff-1',
                  targetPath: '/staff/dashboard',
                })
              }
            >
              Login as Staff
            </Button>
            <Button
              variant="soft"
              disabled={pendingRole !== null}
              loading={pendingRole === 'customer'}
              onClick={() =>
                void loginAsRole({
                  role: 'customer',
                  seedUserId: 'customer-1',
                  targetPath: '/customer/home',
                })
              }
            >
              Login as Customer
            </Button>
            <Button
              variant="soft"
              disabled={pendingRole !== null}
              loading={pendingRole === 'worker'}
              onClick={() =>
                void loginAsRole({
                  role: 'worker',
                  seedUserId: 'worker-1',
                  targetPath: '/worker/home',
                })
              }
            >
              Login as Worker
            </Button>
          </Flex>

          {loginError && <Badge color="red">{loginError}</Badge>}

          <Text size="2" color="gray">Select a role to authenticate with a seeded demo account.</Text>
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

import { Badge, Button, Card, Flex, Heading, Link, Text } from '@radix-ui/themes';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { clearAuthState, readAuthState, writeAuthState } from '../lib/auth';
import { fetchHealth, login } from '../lib/api';

export const LandingPage = () => {
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authState, setAuthState] = useState(() => readAuthState());
  const navigate = useNavigate();

  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: fetchHealth,
    retry: false,
  });

  const loginAs = async (userId: string) => {
    setIsLoggingIn(true);

    try {
      const session = await login(userId);
      writeAuthState(session);
      setAuthState(session);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const logout = () => {
    clearAuthState();
    setAuthState(null);
  };

  return (
    <Flex minHeight="100vh" align="center" justify="center" p="6">
      <Card size="3" style={{ width: '100%', maxWidth: 620 }}>
        <Flex direction="column" gap="4">
          <Heading size="7">CrewPulse</Heading>
          <Text color="gray">Auth + role-gated navigation demo.</Text>

          {healthQuery.isPending && <Badge color="gray">Checking API health...</Badge>}
          {healthQuery.isError && <Badge color="red">API unavailable</Badge>}
          {healthQuery.data && <Badge color="green">API healthy</Badge>}

          <Flex gap="2" wrap="wrap">
            <Button disabled={isLoggingIn} onClick={() => void loginAs('staff-1')}>
              Login as staff
            </Button>
            <Button disabled={isLoggingIn} onClick={() => void loginAs('customer-1')}>
              Login as customer
            </Button>
            <Button disabled={isLoggingIn} onClick={() => void loginAs('worker-1')}>
              Login as worker
            </Button>
            <Button color="gray" variant="soft" onClick={logout}>
              Logout
            </Button>
          </Flex>

          {authState ? (
            <Text size="2">Signed in as {authState.userId}</Text>
          ) : (
            <Text size="2" color="gray">
              Sign in to navigate protected pages.
            </Text>
          )}

          <Flex direction="column" gap="2">
            <Link onClick={() => navigate('/workers/worker-1')}>Worker profile (staff-only)</Link>
            <Link onClick={() => navigate('/workers/worker-1/profile-analytics')}>
              Worker analytics (staff-only; worker self denied)
            </Link>
            <Link onClick={() => navigate('/assignments/a-1/customer-rating')}>
              Submit customer rating (customer/staff)
            </Link>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};

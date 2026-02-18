import { FormEvent, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Flex,
  Grid,
  Heading,
  Separator,
  Text,
  TextArea,
  TextField,
} from '@radix-ui/themes';
import { useNavigate } from 'react-router-dom';

import { ApiError, login } from '../lib/api';
import { writeAuthState } from '../lib/auth';

export const LandingPage = () => {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [pendingLogin, setPendingLogin] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const [requestName, setRequestName] = useState('');
  const [requestReason, setRequestReason] = useState('');
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestSuccess, setRequestSuccess] = useState<string | null>(null);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);

    if (!username.trim() || !password) {
      setLoginError('Username and password are required.');
      return;
    }

    setPendingLogin(true);

    try {
      const nextAuth = await login(username.trim(), password);
      writeAuthState(nextAuth);
      setPassword('');
      navigate('/home');
    } catch (error) {
      if (error instanceof ApiError) {
        setLoginError(error.message);
      } else {
        setLoginError('Sign-in failed. Please try again.');
      }
    } finally {
      setPendingLogin(false);
    }
  };

  const handleAccountRequest = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setRequestError(null);
    setRequestSuccess(null);

    if (!requestName.trim()) {
      setRequestError('Enter a username to request an account.');
      return;
    }

    if (requestReason.trim().length < 10) {
      setRequestError('Tell us briefly why you need access (10+ characters).');
      return;
    }

    setRequestSuccess('Request received. A moderator will review your account request.');
    setRequestName('');
    setRequestReason('');
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
          <Text color="gray">Sign in with credentials to access your workspace.</Text>

          <Grid columns={{ initial: '1', md: '2' }} gap="4">
            <Card variant="surface">
              <form onSubmit={(event) => void handleLogin(event)}>
                <Flex direction="column" gap="3">
                  <Heading size="5">Login</Heading>
                  <TextField.Root
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="Username"
                    autoComplete="username"
                  />
                  <TextField.Root
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Password"
                    autoComplete="current-password"
                  />
                  <Button type="submit" loading={pendingLogin} disabled={pendingLogin}>
                    Sign in
                  </Button>
                  {loginError && <Badge color="red">{loginError}</Badge>}
                </Flex>
              </form>
            </Card>

            <Card variant="surface">
              <form onSubmit={handleAccountRequest}>
                <Flex direction="column" gap="3">
                  <Heading size="5">Request account</Heading>
                  <Text size="2" color="gray">
                    Account creation is moderator-managed. Submit a request for review.
                  </Text>
                  <TextField.Root
                    value={requestName}
                    onChange={(event) => setRequestName(event.target.value)}
                    placeholder="Desired username"
                  />
                  <TextArea
                    value={requestReason}
                    onChange={(event) => setRequestReason(event.target.value)}
                    placeholder="Reason for access"
                  />
                  <Button type="submit" variant="soft">
                    Submit request
                  </Button>
                  {requestError && <Badge color="red">{requestError}</Badge>}
                  {requestSuccess && <Badge color="green">{requestSuccess}</Badge>}
                </Flex>
              </form>
            </Card>
          </Grid>

          <Separator size="4" />
          <Text size="2" color="gray">
            Authentication errors are shown as safe user-facing messages.
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

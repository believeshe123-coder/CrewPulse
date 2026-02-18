import type { UserRole } from '@crewpulse/contracts';
import { Card, Flex, Heading, Text } from '@radix-ui/themes';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { readAuthState } from '../lib/auth';

type RoleGuardProps = {
  allowedRoles: UserRole[];
};

export const RoleGuard = ({ allowedRoles }: RoleGuardProps) => {
  const auth = readAuthState();
  const location = useLocation();

  if (!auth) {
    return <Navigate to="/" replace state={{ from: location.pathname }} />;
  }

  if (!allowedRoles.includes(auth.role)) {
    return (
      <Flex minHeight="100vh" align="center" justify="center" p="6">
        <Card size="3" style={{ width: '100%', maxWidth: 520 }}>
          <Heading size="5">Access denied</Heading>
          <Text color="gray">Role {auth.role} cannot access this page.</Text>
        </Card>
      </Flex>
    );
  }

  return <Outlet />;
};

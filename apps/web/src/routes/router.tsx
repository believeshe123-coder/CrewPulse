import { createHashRouter } from 'react-router-dom';

import { AssignmentDetailPage } from './AssignmentDetailPage';
import { AssignmentsPage } from './AssignmentsPage';
import { LandingPage } from './LandingPage';
import { RoleGuard } from './RoleGuard';
import { StaffDashboardPage } from './StaffDashboardPage';
import { WorkerAnalyticsPage } from './WorkerAnalyticsPage';
import { WorkerProfilePage } from './WorkerProfilePage';

export const router = createHashRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    element: <RoleGuard allowedRoles={['staff']} />,
    children: [
      {
        path: '/staff/dashboard',
        element: <StaffDashboardPage />,
      },
      {
        path: '/workers/:id',
        element: <WorkerProfilePage />,
      },
      {
        path: '/workers/:id/profile-analytics',
        element: <WorkerAnalyticsPage />,
      },
      {
        path: '/assignments',
        element: <AssignmentsPage />,
      },
      {
        path: '/assignments/:id',
        element: <AssignmentDetailPage />,
      },
    ],
  },
  {
    element: <RoleGuard allowedRoles={['customer', 'staff']} />,
    children: [
      {
        path: '/assignments/:id/customer-rating',
        element: <AssignmentDetailPage />,
      },
    ],
  },
]);

import { createHashRouter } from 'react-router-dom';

import { AddEmployeePage } from './AddEmployeePage';
import { AssignmentDetailPage } from './AssignmentDetailPage';
import { AssignmentsPage } from './AssignmentsPage';
import { LandingPage } from './LandingPage';
import { PostLoginHomePage } from './PostLoginHomePage';
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
    element: <RoleGuard allowedRoles={['staff', 'moderator']} />,
    children: [
      {
        path: '/home',
        element: <PostLoginHomePage />,
      },
      {
        path: '/assignments',
        element: <AssignmentsPage />,
      },
      {
        path: '/assignments/:id',
        element: <AssignmentDetailPage />,
      },
      {
        path: '/assignments/:id/customer-rating',
        element: <AssignmentDetailPage />,
      },
    ],
  },
  {
    element: <RoleGuard allowedRoles={['staff']} />,
    children: [
      {
        path: '/staff/dashboard',
        element: <StaffDashboardPage />,
      },
      {
        path: '/staff/employees/new',
        element: <AddEmployeePage />,
      },
      {
        path: '/workers/:id',
        element: <WorkerProfilePage />,
      },
      {
        path: '/workers/:id/profile-analytics',
        element: <WorkerAnalyticsPage />,
      },
    ],
  },
]);

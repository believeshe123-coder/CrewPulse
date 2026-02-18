import { createBrowserRouter } from 'react-router-dom';

import { AssignmentDetailPage } from './AssignmentDetailPage';
import { AssignmentsPage } from './AssignmentsPage';
import { LandingPage } from './LandingPage';
import { RoleGuard } from './RoleGuard';
import { WorkerAnalyticsPage } from './WorkerAnalyticsPage';
import { WorkerProfilePage } from './WorkerProfilePage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  {
    element: <RoleGuard allowedRoles={['staff']} />,
    children: [
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

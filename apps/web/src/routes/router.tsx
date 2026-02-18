import { createBrowserRouter } from 'react-router-dom';

import { LandingPage } from './LandingPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
]);

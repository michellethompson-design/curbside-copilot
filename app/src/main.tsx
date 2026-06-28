import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createHashRouter, RouterProvider } from 'react-router-dom';
import './index.css';

import { AppShell } from './components/AppShell';
import { OrganizerLayout } from './components/OrganizerLayout';
import { ToastProvider } from './components/ui';
import { StoreProvider } from './store/AppStore';
import { PreferencesProvider } from './store/Preferences';

import { Home } from './pages/Home';
import { Submit } from './pages/Submit';
import { SpeakerPortal } from './pages/SpeakerPortal';
import { EventPublic } from './pages/EventPublic';
import { CertificatePage } from './pages/Certificate';
import { NotFound } from './pages/NotFound';
import { Dashboard } from './pages/organizer/Dashboard';
import { ReviewQueue } from './pages/organizer/ReviewQueue';
import { Agenda } from './pages/organizer/Agenda';
import { Roster } from './pages/organizer/Roster';
import { Credits } from './pages/organizer/Credits';
import { EventHistory } from './pages/organizer/EventHistory';

const router = createHashRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <Home /> },
      { path: 'submit', element: <Submit /> },
      { path: 'submit/:id', element: <Submit /> },
      { path: 'speaker', element: <SpeakerPortal /> },
      { path: 'event', element: <EventPublic /> },
      { path: 'certificate/:id', element: <CertificatePage /> },
      {
        path: 'organizer',
        element: <OrganizerLayout />,
        children: [
          { index: true, element: <Dashboard /> },
          { path: 'review', element: <ReviewQueue /> },
          { path: 'agenda', element: <Agenda /> },
          { path: 'roster', element: <Roster /> },
          { path: 'credits', element: <Credits /> },
          { path: 'history', element: <EventHistory /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PreferencesProvider>
      <StoreProvider>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </StoreProvider>
    </PreferencesProvider>
  </StrictMode>,
);

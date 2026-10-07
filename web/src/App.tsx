import { useCallback, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { getToken } from './api';
import { AuthDialog } from './components/AuthDialog';
import { PlannerPage } from './PlannerPage';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);
  const [authOpen, setAuthOpen] = useState(false);

  const handleLoggedIn = useCallback(() => {
    setLoggedIn(true);
    setAuthOpen(false);
  }, []);
  const handleLoggedOut = useCallback(() => setLoggedIn(false), []);
  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  return (
    <MotionConfig reducedMotion="user">
      {/* The key resets the planner when switching between guest and account tasks. */}
      <PlannerPage
        key={loggedIn ? 'account' : 'guest'}
        loggedIn={loggedIn}
        onSignIn={openAuth}
        onLoggedOut={handleLoggedOut}
      />
      <AuthDialog open={authOpen} onClose={closeAuth} onLoggedIn={handleLoggedIn} />
    </MotionConfig>
  );
}

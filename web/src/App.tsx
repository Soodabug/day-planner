import { useCallback, useState } from 'react';
import { MotionConfig } from 'motion/react';
import { getToken } from './api';
import { AuthDialog } from './components/AuthDialog';
import { ResetPasswordDialog } from './components/ResetPasswordDialog';
import { PlannerPage } from './PlannerPage';

// The "forgot password" email links to /?reset=<token>.
function readResetToken() {
  return new URLSearchParams(window.location.search).get('reset');
}

// Take the token out of the address bar so it is not bookmarked or shared by accident.
function removeResetTokenFromUrl() {
  window.history.replaceState(null, '', window.location.pathname);
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);
  const [authOpen, setAuthOpen] = useState(false);
  const [resetToken, setResetToken] = useState(readResetToken);

  const closeReset = useCallback(() => {
    setResetToken(null);
    removeResetTokenFromUrl();
  }, []);

  const handleLoggedIn = useCallback(() => {
    setLoggedIn(true);
    setAuthOpen(false);
    closeReset();
  }, [closeReset]);
  const handleLoggedOut = useCallback(() => setLoggedIn(false), []);
  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  const requestNewLink = useCallback(() => {
    closeReset();
    setAuthOpen(true);
  }, [closeReset]);

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
      <ResetPasswordDialog
        token={resetToken}
        onClose={closeReset}
        onLoggedIn={handleLoggedIn}
        onRequestNewLink={requestNewLink}
      />
    </MotionConfig>
  );
}

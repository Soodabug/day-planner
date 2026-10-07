import { useCallback, useState } from 'react';
import { getToken } from './api';
import { LoginPage } from './LoginPage';
import { TasksPage } from './TasksPage';

export default function App() {
  const [loggedIn, setLoggedIn] = useState(() => getToken() !== null);

  const handleLoggedIn = useCallback(() => setLoggedIn(true), []);
  const handleLoggedOut = useCallback(() => setLoggedIn(false), []);

  if (loggedIn) {
    return <TasksPage onLoggedOut={handleLoggedOut} />;
  }

  return <LoginPage onLoggedIn={handleLoggedIn} />;
}

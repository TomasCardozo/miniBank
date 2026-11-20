import { useEffect, useState } from 'react';
import { setUnauthorizedHandler } from '../api/client';
import { getCurrentUser, loginUser, registerUser } from '../api/authApi';
import { AuthContext } from './useAuth';

const TOKEN_STORAGE_KEY = 'minibank.accessToken';

export default function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(Boolean(accessToken));

  useEffect(() => {
    return setUnauthorizedHandler(clearSession);
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadCurrentUser() {
      if (!accessToken) {
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const currentUser = await getCurrentUser(accessToken);

        if (!ignore) {
          setUser(currentUser);
        }
      } catch (error) {
        if (!ignore) {
          if (error.status === 401) {
            clearSession();
          } else {
            setError(error);
          }
          setUser(null);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    loadCurrentUser();

    return () => {
      ignore = true;
    };
  }, [accessToken]);

  async function login(credentials) {
    const response = await loginUser(credentials);
    setError(null);
    saveSession(response.accessToken, response.user);
    return response;
  }

  async function register(payload) {
    const response = await registerUser(payload);
    setError(null);
    saveSession(response.accessToken, response.user);
    return response;
  }

  function saveSession(token, sessionUser) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
    setAccessToken(token);
    setUser(sessionUser || null);
  }

  function clearSession() {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    setAccessToken(null);
    setUser(null);
    setError(null);
  }

  const value = {
    accessToken,
    user,
    error,
    loading,
    isAuthenticated: Boolean(accessToken),
    login,
    register,
    logout: clearSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

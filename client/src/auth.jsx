import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { api, API_URL } from './api.js';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem('token')) return setLoading(false);
    api
      .get('/auth/me')
      .then((r) => setUser(r.data.user))
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  // One authenticated WebSocket connection for the whole session.
  useEffect(() => {
    if (!user) return;
    const s = io(API_URL || undefined, { auth: { token: localStorage.getItem('token') } });
    setSocket(s);
    return () => {
      s.disconnect();
      setSocket(null);
    };
  }, [user]);

  const authenticate = async (path, body) => {
    const { data } = await api.post(`/auth/${path}`, body);
    localStorage.setItem('token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        socket,
        loading,
        login: (b) => authenticate('login', b),
        register: (b) => authenticate('register', b),
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { RecordModel } from 'pocketbase';

interface AuthContextType {
  user: RecordModel | null;
  isAdmin: boolean;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isLoading: true,
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.model);
  const [isAdmin, setIsAdmin] = useState<boolean>(pb.authStore.model?.role === 'admin');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Escuta mudanças de autenticação
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
      setIsAdmin(model?.role === 'admin');
    });

    setIsLoading(false);

    return () => {
      unsubscribe();
    };
  }, []);

  const logout = () => {
    pb.authStore.clear();
  };

  return (
    <AuthContext.Provider value={{ user, isAdmin, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

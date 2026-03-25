import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { RecordModel } from 'pocketbase';

interface AuthContextType {
  user: RecordModel | null;
  isLoading: boolean;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  logout: () => {},
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<RecordModel | null>(pb.authStore.model);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Escuta mudanças de autenticação
    const unsubscribe = pb.authStore.onChange((token, model) => {
      setUser(model);
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
    <AuthContext.Provider value={{ user, isLoading, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);

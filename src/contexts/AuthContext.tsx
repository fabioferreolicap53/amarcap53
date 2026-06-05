import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { RecordModel } from 'pocketbase';

interface UserRecord extends RecordModel {
  name?: string;
  unidade_saude: string;
  equipe: string;
  microarea: string;
  role: 'cap' | 'unidade' | 'equipe' | 'microarea' | 'admin' | 'user';
}

interface AuthContextType {
  user: UserRecord | null;
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
  const [user, setUser] = useState<UserRecord | null>(pb.authStore.model as UserRecord);
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    const model = pb.authStore.model as UserRecord;
    return model?.role === 'admin' || model?.role === 'cap';
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Escuta mudanças de autenticação
    const unsubscribe = pb.authStore.onChange((token, model) => {
      const userModel = model as UserRecord;
      setUser(userModel);
      setIsAdmin(userModel?.role === 'admin' || userModel?.role === 'cap');
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

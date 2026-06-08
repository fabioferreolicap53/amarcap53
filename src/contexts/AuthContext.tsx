import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { RecordModel } from 'pocketbase';

interface UserRecord extends RecordModel {
  name?: string;
  unidade_saude: string;
  equipe: string;
  microarea: string;
  role: 'cap' | 'unidade' | 'equipe' | 'microarea' | 'admin' | 'user';
  favoritos?: string[];
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

  useEffect(() => {
    if (!user?.id) return;

    const collectionName =
      (user as UserRecord & { collectionName?: string }).collectionName ||
      (pb.authStore.model as UserRecord & { collectionName?: string })?.collectionName ||
      'users';

    let disposed = false;
    let userUnsubscribe: (() => void) | undefined;

    pb.collection(collectionName)
      .subscribe(user.id, (e) => {
        if (e.action === 'update') {
          const updatedUser = e.record as UserRecord;
          setUser(updatedUser);
          setIsAdmin(updatedUser?.role === 'admin' || updatedUser?.role === 'cap');
          pb.authStore.save(pb.authStore.token, updatedUser);
        }
      })
      .then((unsub) => {
        if (disposed) {
          unsub();
          return;
        }
        userUnsubscribe = unsub;
      })
      .catch((error) => {
        console.error('Erro ao inscrever sincronizacao do usuario:', error);
      });

    return () => {
      disposed = true;
      if (userUnsubscribe) userUnsubscribe();
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    const collectionName =
      (user as UserRecord & { collectionName?: string }).collectionName ||
      (pb.authStore.model as UserRecord & { collectionName?: string })?.collectionName ||
      'users';

    let cancelled = false;

    const syncCurrentUser = async (reason: string) => {
      try {
        const freshUser = await pb.collection(collectionName).getOne(user.id);
        if (cancelled) return;

        // Só atualiza se houver mudança real para evitar loops e overwrites de optimistic updates
        const currentFavoritos = JSON.stringify(user.favoritos || []);
        const freshFavoritos = JSON.stringify((freshUser as UserRecord).favoritos || []);
        
        if (currentFavoritos !== freshFavoritos || (freshUser as UserRecord).role !== user.role) {
          setUser(freshUser as UserRecord);
          setIsAdmin((freshUser as UserRecord)?.role === 'admin' || (freshUser as UserRecord)?.role === 'cap');
          pb.authStore.save(pb.authStore.token, freshUser);
        }
      } catch (error) {
        // Erro silencioso no polling
      }
    };

    const intervalId = window.setInterval(() => {
      syncCurrentUser('interval');
    }, 5000);

    const handleFocus = () => {
      syncCurrentUser('focus');
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncCurrentUser('visibility');
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    syncCurrentUser('mount');

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [user?.id]);

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

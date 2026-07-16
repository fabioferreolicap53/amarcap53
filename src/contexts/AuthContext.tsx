import React, { createContext, useContext, useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { RecordModel } from 'pocketbase';

interface UserRecord extends RecordModel {
  name?: string;
  unidade_saude: string;
  equipe: string;
  microarea: number;
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
    let disposed = false;
    let safetyTimer: ReturnType<typeof setTimeout>;

    try {
      const unsubscribe = pb.authStore.onChange((token, model) => {
        if (disposed) return;
        const userModel = model as UserRecord;
        setUser(userModel);
        setIsAdmin(userModel?.role === 'admin' || userModel?.role === 'cap');
      });

      setIsLoading(false);

      return () => {
        disposed = true;
        clearTimeout(safetyTimer);
        unsubscribe();
      };
    } catch (err) {
      console.error('[Auth] Erro ao inicializar authStore:', err);
      setIsLoading(false);
    }

    // Safety: força isLoading=false após 4s mesmo se algo falhar
    safetyTimer = setTimeout(() => {
      if (!disposed) setIsLoading(false);
    }, 4000);

    return () => {
      disposed = true;
      clearTimeout(safetyTimer);
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
    let retries = 0;
    const maxRetries = 3;

    const doSubscribe = () => {
      if (disposed) return;
      pb.collection(collectionName)
        .subscribe(user.id, (e) => {
          if (e.action === 'update') {
            const updatedUser = e.record as UserRecord;
            setUser(updatedUser);
            setIsAdmin(updatedUser?.role === 'admin' || updatedUser?.role === 'cap');
            pb.authStore.save(pb.authStore.token, updatedUser);
          }
        }, { requestKey: null })
        .then((unsub) => {
          retries = 0;
          if (disposed) {
            unsub();
            return;
          }
          userUnsubscribe = unsub;
        })
        .catch(() => {
          if (!disposed && retries < maxRetries) {
            retries++;
            setTimeout(doSubscribe, 2000 * retries);
          }
        });
    };

    doSubscribe();

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
    let pendingSync: Promise<void> | null = null;
    let lastSyncTime = 0;
    const SYNC_INTERVAL = 30000; // 30s entre syncs

    const syncCurrentUser = async () => {
      // Evita syncs muito frequentes (proteção contra múltiplos eventos focus/visibility)
      const now = Date.now();
      if (now - lastSyncTime < 10000) return;
      lastSyncTime = now;

      // Se já tem sync pendente, aguarda
      if (pendingSync) {
        await pendingSync.catch(() => {});
        return;
      }

      const sync = (async () => {
        try {
          const freshUser = await pb.collection(collectionName).getOne(user.id, {
            requestKey: null,
          });
          if (cancelled) return;

          const currentFavoritos = JSON.stringify(user.favoritos || []);
          const freshFavoritos = JSON.stringify((freshUser as UserRecord).favoritos || []);
          
          if (currentFavoritos !== freshFavoritos || (freshUser as UserRecord).role !== user.role) {
            setUser(freshUser as UserRecord);
            setIsAdmin((freshUser as UserRecord)?.role === 'admin' || (freshUser as UserRecord)?.role === 'cap');
            pb.authStore.save(pb.authStore.token, freshUser);
          }
        } catch (error) {
          // Erro silencioso (rede, timeout, etc)
        }
      })();

      pendingSync = sync;
      await sync.catch(() => {});
      pendingSync = null;
    };

    const intervalId = window.setInterval(syncCurrentUser, SYNC_INTERVAL);

    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedSync = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(syncCurrentUser, 600); // 600ms debounce
    };

    const handleFocus = debouncedSync;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        debouncedSync();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Primeira sync com delay para não travar a inicialização
    const initialSyncTimer = setTimeout(syncCurrentUser, 2000);

    return () => {
      cancelled = true;
      pendingSync = null;
      clearTimeout(initialSyncTimer);
      clearTimeout(debounceTimer);
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

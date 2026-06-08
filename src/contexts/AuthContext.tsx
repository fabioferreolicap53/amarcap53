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
      // #region debug-point A:auth-store-change
      fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"favorites-sync-devices",runId:"pre-fix",hypothesisId:"A",location:"AuthContext.tsx:onChange",msg:"[DEBUG] authStore mudou",data:{userId:userModel?.id||null,collectionName:(userModel as UserRecord & { collectionName?: string })?.collectionName||null,favoritos:userModel?.favoritos||[]},ts:Date.now()})}).catch(()=>{});
      // #endregion
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
        // #region debug-point B:realtime-user-update
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"favorites-sync-devices",runId:"pre-fix",hypothesisId:"B",location:"AuthContext.tsx:subscribe",msg:"[DEBUG] realtime user event",data:{action:e.action,userId:user.id,collectionName,favoritos:(e.record as UserRecord)?.favoritos||[]},ts:Date.now()})}).catch(()=>{});
        // #endregion
        if (e.action === 'update') {
          const updatedUser = e.record as UserRecord;
          setUser(updatedUser);
          setIsAdmin(updatedUser?.role === 'admin' || updatedUser?.role === 'cap');
          pb.authStore.save(pb.authStore.token, updatedUser);
        }
      })
      .then((unsub) => {
        // #region debug-point C:subscribe-ok
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"favorites-sync-devices",runId:"pre-fix",hypothesisId:"C",location:"AuthContext.tsx:subscribe-then",msg:"[DEBUG] subscribe user ok",data:{userId:user.id,collectionName},ts:Date.now()})}).catch(()=>{});
        // #endregion
        if (disposed) {
          unsub();
          return;
        }
        userUnsubscribe = unsub;
      })
      .catch((error) => {
        // #region debug-point D:subscribe-error
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"favorites-sync-devices",runId:"pre-fix",hypothesisId:"D",location:"AuthContext.tsx:subscribe-catch",msg:"[DEBUG] subscribe user erro",data:{userId:user.id,collectionName,error:String(error)},ts:Date.now()})}).catch(()=>{});
        // #endregion
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
          // #region debug-point M:poll-user-sync
          fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"favorites-sync-devices",runId:"pre-fix",hypothesisId:"M",location:"AuthContext.tsx:poll-sync",msg:"[DEBUG] poll user sync - data changed",data:{reason,userId:user.id,collectionName,favoritos:(freshUser as UserRecord).favoritos||[]},ts:Date.now()})}).catch(()=>{});
          // #endregion

          setUser(freshUser as UserRecord);
          setIsAdmin((freshUser as UserRecord)?.role === 'admin' || (freshUser as UserRecord)?.role === 'cap');
          pb.authStore.save(pb.authStore.token, freshUser);
        }
      } catch (error) {
        // #region debug-point N:poll-user-sync-error
        fetch("http://127.0.0.1:7777/event",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({sessionId:"favorites-sync-devices",runId:"pre-fix",hypothesisId:"N",location:"AuthContext.tsx:poll-sync-error",msg:"[DEBUG] poll user sync erro",data:{reason,userId:user.id,collectionName,error:String(error)},ts:Date.now()})}).catch(()=>{});
        // #endregion
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

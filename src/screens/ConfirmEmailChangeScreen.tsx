import React, { useState, useEffect } from 'react';
import { pb } from '../lib/pocketbase';
import { Mail, Lock, Eye, EyeOff, CheckCircle2, ShieldAlert } from 'lucide-react';
import { AppKey, extractTokenFromLocation, getAuthTargetFromToken, getLoginUrlForApp, persistAuthTarget } from '../lib/authTarget';

export function ConfirmEmailChangeScreen() {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [token, setToken] = useState('');
  const [appKey, setAppKey] = useState<AppKey | null>(null);
  const [targetCollection, setTargetCollection] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const tokenParam = extractTokenFromLocation();

    if (tokenParam) {
      const nextTarget = getAuthTargetFromToken(tokenParam);
      setToken(tokenParam);
      setAppKey(nextTarget.appKey);
      setTargetCollection(nextTarget.collectionRef || '');
      persistAuthTarget(nextTarget.collectionRef, nextTarget.appKey);
    } else {
      setError('Token de confirmação inválido ou ausente. Por favor, solicite um novo link.');
    }
  }, []);

  const toggleShowPassword = () => setShowPassword(!showPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!token) {
      setError('Link inválido. Solicite a alteração novamente.');
      return;
    }

    if (!password) {
      setError('A senha é obrigatória.');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const collectionRef = targetCollection;
      if (!collectionRef) {
        throw new Error('Coleção de autenticação não identificada no token.');
      }

      await pb.collection(collectionRef).confirmEmailChange(token, password);
      setSuccess(true);
    } catch (err: any) {
      console.error(err);
      setError('Não foi possível alterar o e-mail. A senha pode estar incorreta ou o link expirou.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    const appName = appKey === 'agenda' ? 'Agenda' : appKey === 'amarcap53' ? 'AMAR' : 'aplicativo';

    return (
      <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          <div className="bg-white py-12 px-4 shadow-2xl sm:rounded-[2rem] sm:px-10 border border-primary/5 text-center">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-emerald-100 mb-6">
              <CheckCircle2 className="h-10 w-10 text-emerald-600" />
            </div>
            <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">E-mail Alterado!</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              O seu novo endereço de e-mail no <strong>{appName}</strong> foi confirmado com sucesso.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => window.location.href = getLoginUrlForApp(appKey)}
                className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-black text-white bg-slate-800 hover:bg-slate-900 transition-all uppercase tracking-wider"
              >
                Ir para o Login {appKey ? `do ${appName}` : 'do aplicativo'}
              </button>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                Ou feche esta janela e volte para o seu aplicativo.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans relative overflow-hidden">
      {/* Background decoration genérico */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-400/5 rounded-full blur-3xl"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-purple-400/5 rounded-full blur-3xl"></div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="flex justify-center mb-4">
          <div className="h-16 w-16 bg-slate-800 rounded-2xl flex items-center justify-center shadow-lg">
            <Mail className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-2 text-center text-3xl font-extrabold text-slate-800 tracking-tight">
          Central de Acesso
        </h2>
        <p className="mt-2 text-center text-sm font-medium text-slate-500 uppercase tracking-widest">
          Confirmação de Troca de E-mail
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        <div className="bg-white border border-slate-200/60 py-8 px-4 shadow-2xl sm:rounded-[2rem] sm:px-10">
          
          {error && (
            <div className="mb-6 bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-rose-700">{error}</p>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <p className="text-sm text-slate-600 text-center mb-4">
              Por motivos de segurança, insira sua senha atual para confirmar a alteração do e-mail.
            </p>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-2">Sua Senha Atual</label>
              <div className="relative rounded-xl shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full pl-11 pr-11 text-slate-800 bg-slate-50 border-2 border-transparent rounded-xl py-3 focus:bg-white focus:ring-0 focus:border-slate-800 transition-all font-medium"
                  placeholder="Insira sua senha"
                  disabled={!token || isLoading}
                />
                <button
                  type="button"
                  onClick={toggleShowPassword}
                  className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full flex justify-center py-3.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-black text-white bg-slate-800 hover:bg-slate-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-800 transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              {isLoading ? 'Confirmando...' : 'Confirmar Alteração'}
            </button>
          </form>
          
          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
              Ambiente Seguro • Central de Dados
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

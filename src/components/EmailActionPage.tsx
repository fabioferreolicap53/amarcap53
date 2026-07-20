import React, { useState, useEffect, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import { Heart, Shield, Mail, Lock, CheckCircle2, AlertTriangle, Loader2, ArrowLeft, Eye, EyeOff, BadgeCheck } from 'lucide-react';

type Action = 'verify' | 'reset_password' | 'confirm_email_change';
type Status = 'loading' | 'form' | 'success' | 'error';

interface EmailActionPageProps {
  action: Action;
  token: string;
  onError?: (msg: string) => void;
  onSuccess?: (msg: string) => void;
}

const ACTION_CONFIG = {
  verify: {
    title: 'Verificação de E-mail',
    subtitle: 'Ativando sua conta',
    loadingText: 'Verificando seu e-mail...',
    loadingDesc: 'Aguarde enquanto confirmamos seu endereço de e-mail.',
    icon: Mail,
    successTitle: 'E-mail Verificado!',
    successDesc: 'Sua conta foi ativada com sucesso. Agora você pode acessar o sistema.',
    errorTitle: 'Não foi possível verificar',
    errorDesc: 'O link de verificação pode ter expirado ou já ter sido utilizado.',
  },
  reset_password: {
    title: 'Redefinição de Senha',
    subtitle: 'Criar nova senha',
    loadingText: 'Validando link de recuperação...',
    loadingDesc: 'Aguarde enquanto verificamos seu pedido.',
    icon: Lock,
    successTitle: 'Senha Redefinida!',
    successDesc: 'Sua senha foi alterada com sucesso. Agora você pode fazer login com a nova senha.',
    errorTitle: 'Link inválido ou expirado',
    errorDesc: 'O link de redefinição de senha pode ter expirado. Solicite uma nova recuperação.',
  },
  confirm_email_change: {
    title: 'Confirmação de Novo E-mail',
    subtitle: 'Alterando endereço de e-mail',
    loadingText: 'Confirmando novo endereço...',
    loadingDesc: 'Aguarde enquanto validamos a alteração do seu e-mail.',
    icon: BadgeCheck,
    successTitle: 'E-mail Alterado!',
    successDesc: 'Seu endereço de e-mail foi atualizado. Faça login com o novo e-mail.',
    errorTitle: 'Não foi possível alterar',
    errorDesc: 'O link de confirmação pode ter expirado. Solicite a alteração novamente.',
  },
};

export function EmailActionPage({ action, token, onError, onSuccess }: EmailActionPageProps) {
  const [status, setStatus] = useState<Status>((action === 'reset_password' || action === 'confirm_email_change') ? 'form' : 'loading');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const processed = useRef(false);

  const config = ACTION_CONFIG[action];
  const Icon = config.icon;

  // Auto-process verify (não precisa de senha)
  useEffect(() => {
    if (action !== 'verify') return;
    if (processed.current) return;
    processed.current = true;
    setStatus('loading');

    fetch(pb.baseURL + '/api/collections/amarcap53_users/confirm-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Accept': 'application/json' },
      body: new URLSearchParams({ token }).toString(),
    }).then(async (resp) => {
      const text = await resp.text();
      let msg = '';
      try { msg = JSON.parse(text).message; } catch { msg = text; }
      if (resp.ok || msg.includes('already') || msg.includes('verificado') || msg.includes('Invalid')) {
        setStatus('success');
        onSuccess?.(config.successDesc);
      } else {
        setError(msg || 'Erro ao verificar');
        setStatus('error');
        onError?.(config.errorDesc);
      }
    }).catch(() => {
      setError('Erro de conexão.');
      setStatus('error');
    });
  }, [action, token]);

  // confirm_email_change: mostra formulário de senha (PocketBase exige senha)
  // reset_password: mostra formulário de nova senha

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) { setError('A senha deve ter pelo menos 8 caracteres.'); return; }
    if (password !== passwordConfirm) { setError('As senhas não conferem.'); return; }
    setStatus('loading');
    try {
      await pb.collection('amarcap53_users').confirmPasswordReset(token, password, passwordConfirm);
      setStatus('success');
      onSuccess?.(config.successDesc);
    } catch (err: any) {
      setError(String(err?.message || 'Erro ao redefinir senha.'));
      setStatus('error');
    }
  };

  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) { setError('Digite sua senha atual para confirmar.'); return; }
    setStatus('loading');
    try {
      await pb.collection('amarcap53_users').confirmEmailChange(token, password);
      setStatus('success');
      onSuccess?.(config.successDesc);
    } catch (err: any) {
      const msg = String(err?.message || '');
      if (msg.includes('expired') || msg.includes('expirado')) {
        setError('O link de confirmação expirou. Solicite a alteração novamente.');
      } else if (msg.includes('invalid') || msg.includes('inválid')) {
        setError('Senha incorreta. Tente novamente.');
      } else {
        setError(msg || 'Erro ao confirmar alteração de e-mail.');
      }
      setStatus('error');
    }
  };

  return (
    <div className="min-h-dvh min-h-[100dvh] flex flex-col font-sans bg-[#f0f2f5]">
      {/* Brand Panel — Desktop */}
      <div className="hidden lg:flex lg:w-1/2 fixed inset-0 left-0 w-1/2 z-0 overflow-hidden bg-gradient-to-br from-[#001b3d] via-[#002b5c] to-[#003d7a]">
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-[floatSlow_20s_ease-in-out_infinite]" />
          <div className="absolute bottom-20 -right-20 w-[30rem] h-[30rem] bg-blue-400/5 rounded-full blur-3xl animate-[floatSlow_25s_ease-in-out_infinite_reverse]" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-60" />
        </div>
        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 py-12 w-full">
          <div className="flex items-center gap-5 mb-16 animate-[fadeSlideIn_0.6s_ease-out_0.2s_both]">
            <div className="w-16 h-16 rounded-[1.25rem] bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-black/10 ring-1 ring-white/10">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">AMAR</h1>
              <p className="text-blue-200/70 text-[11px] xl:text-xs font-bold uppercase tracking-[0.2em] mt-1">ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO</p>
            </div>
          </div>
          <div className="space-y-6 mb-16 animate-[fadeSlideIn_0.6s_ease-out_0.4s_both]">
            <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
              Acompanhamento<br />
              <span className="text-blue-300 bg-gradient-to-r from-blue-300 to-blue-200 bg-clip-text text-transparent">que salva vidas</span>
            </h2>
            <p className="text-blue-200/70 text-[0.9375rem] font-medium leading-relaxed max-w-md">
              Plataforma integrada para gestão e monitoramento de pacientes no rastreamento do câncer do colo do útero.
            </p>
          </div>
          <div className="mt-auto pt-20 border-t border-white/[0.07] animate-[fadeSlideIn_0.6s_ease-out_1s_both]">
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-px h-4 bg-blue-400/40" />
                <p className="text-blue-200/55 text-[10px] font-bold uppercase tracking-[0.15em]">Coordenadoria Geral de Atenção Primária — AP 5.3</p>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-px h-3 bg-blue-400/25" />
                <p className="text-blue-300/35 text-[10px] font-semibold tracking-[0.2em]">© 2026 AMAR — Todos os direitos reservados</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Panel */}
      <div className="relative z-10 w-full lg:w-1/2 lg:ml-auto flex flex-col min-h-dvh min-h-[100dvh] overflow-y-auto overscroll-contain">
        <div className="flex-1 flex items-center justify-center px-4 py-6 sm:px-8 md:px-10 lg:px-14 xl:px-16"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
          <div className="w-full max-w-[440px] lg:max-w-[400px] xl:max-w-[420px]">

            {/* Mobile Logo */}
            <div className="lg:hidden flex flex-col items-center mb-5 sm:mb-10 animate-[fadeSlideIn_0.5s_ease-out]">
              <div className="w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-[1rem] sm:rounded-[1.25rem] bg-gradient-to-br from-[#001b3d] to-[#003d7a] flex items-center justify-center shadow-lg shadow-blue-900/20 ring-1 ring-white/10 mb-2.5 sm:mb-4">
                <Heart className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
              </div>
              <h1 className="text-[1.375rem] sm:text-[1.625rem] font-black text-[#001b3d] tracking-tight">AMAR</h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 text-center max-w-[260px] sm:max-w-[300px] leading-snug">ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO</p>
            </div>

            {/* Action Card */}
            <div className="bg-white/80 sm:bg-white backdrop-blur-xl sm:backdrop-blur-none rounded-[1.25rem] sm:rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:shadow-[0_25px_80px_rgba(0,0,0,0.12)] border border-white/60 sm:border-slate-200/50 lg:border-slate-200/60 p-6 sm:p-8 md:p-10 relative overflow-hidden animate-[fadeSlideIn_0.6s_ease-out_0.1s_both]">

              {/* Top gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-[#001b3d] to-blue-500" />

              {/* Icon + Title */}
              <div className="flex flex-col items-center text-center mb-6 sm:mb-8">
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center mb-4 sm:mb-5 shadow-lg transition-all duration-500 ${
                  status === 'success' ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25' :
                  status === 'error' ? 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/25' :
                  'bg-gradient-to-br from-[#001b3d] to-[#002b5c] shadow-blue-900/20'
                }`}>
                  {status === 'loading' && <Loader2 className="w-8 h-8 sm:w-10 sm:h-10 text-white animate-spin" />}
                  {status === 'form' && <Icon className="w-8 h-8 sm:w-10 sm:h-10 text-white" />}
                  {status === 'success' && <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />}
                  {status === 'error' && <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />}
                </div>
                <h2 className="text-lg sm:text-[1.375rem] md:text-2xl font-black text-[#001b3d] tracking-tight leading-tight">
                  {status === 'loading' ? config.loadingText : status === 'error' ? config.errorTitle : status === 'success' ? config.successTitle : config.title}
                </h2>
                <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5 sm:mt-2">
                  {status === 'loading' ? '' : status === 'error' ? config.errorDesc : status === 'success' ? config.successDesc : config.subtitle}
                </p>
              </div>

              {/* Loading Spinner */}
              {status === 'loading' && action !== 'reset_password' && (
                <div className="flex flex-col items-center gap-4 py-6">
                  <div className="relative">
                    <div className="w-20 h-20 rounded-full border-4 border-slate-100" />
                    <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-transparent border-t-blue-500 animate-spin" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">{config.loadingDesc}</p>
                </div>
              )}

              {/* Reset Password Form */}
              {status === 'form' && action === 'reset_password' && (
                <form className="space-y-4" onSubmit={handleResetPassword}>
                  {error && (
                    <div className="p-3 bg-rose-50/80 border border-rose-100 rounded-xl flex items-start gap-2.5 animate-[shakeIn_0.4s_ease-out]">
                      <div className="w-5 h-5 rounded-md bg-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-[9px] font-black">!</span>
                      </div>
                      <p className="text-[11px] font-bold text-rose-700 leading-snug">{error}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Nova senha</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className="w-full pl-10 pr-12 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="Mín. 8 caracteres"
                        minLength={8}
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center w-11 min-h-[48px] text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Repetir senha</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        value={passwordConfirm}
                        onChange={(e) => { setPasswordConfirm(e.target.value); setError(''); }}
                        className="w-full pl-10 pr-12 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="Repetir senha"
                        minLength={8}
                      />
                      <button type="button" onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center w-11 min-h-[48px] text-slate-400 hover:text-slate-600 transition-colors">
                        {showPasswordConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={status === 'loading'}
                    className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                    Redefinir Senha
                  </button>
                </form>
              )}

              {/* Confirm Email Change Form — precisa de senha atual */}
              {status === 'form' && action === 'confirm_email_change' && (
                <form className="space-y-4" onSubmit={handleConfirmEmailChange}>
                  <p className="text-[13px] text-slate-500 font-medium leading-relaxed bg-slate-50/80 p-4 rounded-xl border border-slate-100">
                    Para confirmar a alteração do seu e-mail, digite sua senha atual.
                  </p>

                  {error && (
                    <div className="p-3 bg-rose-50/80 border border-rose-100 rounded-xl flex items-start gap-2.5 animate-[shakeIn_0.4s_ease-out]">
                      <div className="w-5 h-5 rounded-md bg-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-white text-[9px] font-black">!</span>
                      </div>
                      <p className="text-[11px] font-bold text-rose-700 leading-snug">{error}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Senha atual</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-4 h-4 text-slate-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => { setPassword(e.target.value); setError(''); }}
                        className="w-full pl-10 pr-12 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="Digite sua senha"
                      />
                      <button type="button" onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center w-11 min-h-[48px] text-slate-400 hover:text-slate-600 transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <button type="submit" disabled={status === 'loading'}
                    className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0">
                    Confirmar Alteração
                  </button>
                </form>
              )}

              {/* Success Action */}
              {status === 'success' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <button onClick={() => window.location.href = '/'}
                    className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300">
                    Acessar o Sistema
                  </button>
                </div>
              )}

              {/* Error Action */}
              {status === 'error' && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <button onClick={() => window.location.href = '/'}
                    className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300">
                    <ArrowLeft className="w-4 h-4 inline mr-2" />
                    Voltar para o Login
                  </button>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="mt-5 sm:mt-8 flex flex-col items-center gap-4 sm:gap-8 animate-[fadeSlideIn_0.6s_ease-out_0.3s_both]">
              <div className="flex-col gap-1.5 flex">
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-px h-3 bg-slate-300/30" />
                  <p className="text-slate-400 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.15em] text-center">Coordenadoria Geral de Atenção Primária — AP 5.3</p>
                </div>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-px h-2.5 bg-slate-300/20" />
                  <p className="text-slate-400/70 text-[8px] sm:text-[9px] font-semibold tracking-[0.2em]">© 2026 AMAR — Todos os direitos reservados</p>
                </div>
              </div>
              <p className="text-slate-300 text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.25em] text-center">Desenvolvido por Fabio Ferreira de Oliveira — DAPS/CAP5.3</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

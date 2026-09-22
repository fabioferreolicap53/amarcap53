/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { DashboardScreen } from './screens/DashboardScreen';
import { PatientsScreen } from './screens/PatientsScreen';
import { FollowUpsScreen } from './screens/FollowUpsScreen';
import { FavoritesScreen } from './screens/FavoritesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { SidebarProvider, useSidebar } from './contexts/SidebarContext';
import { InstallBanner } from './components/InstallBanner';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AuthScreen } from './screens/AuthScreen';
import { EmailActionPage } from './components/EmailActionPage';
import { pb } from './lib/pocketbase';
import { Heart, CheckCircle2, AlertTriangle, ArrowRight, Mail } from 'lucide-react';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    return localStorage.getItem('activeTab') || 'resumo';
  });
  const { isOpen, closeSidebar, isMobile, setIsMobile } = useSidebar();
  const { user, isLoading } = useAuth();
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyProcessing, setVerifyProcessing] = useState(false);
  const [emailAction, setEmailAction] = useState<{ action: 'verify' | 'reset_password' | 'confirm_email_change'; token: string } | null>(() => {
    // Lê token síncrono no mount — antes do auth check
    const token = (window as any).__authToken as string | undefined;
    const action = (window as any).__authAction as string | undefined;
    delete (window as any).__authToken;
    delete (window as any).__authAction;
    if (token && token.length >= 10) {
      return { action: (action === 'confirm_email_change' ? 'confirm_email_change' : 'reset_password'), token };
    }
    return null;
  });

  // Para confirmação de troca de e-mail: desloga o usuário para mostrar a página "deslogado"
  const emailChangeLogoutRef = useRef(false);
  useEffect(() => {
    if (emailAction?.action === 'confirm_email_change' && !emailChangeLogoutRef.current && pb.authStore.isValid) {
      emailChangeLogoutRef.current = true;
      pb.authStore.clear();
    }
  }, [emailAction]);

  // Processa verificação de e-mail ANTES de qualquer renderização
  // Funciona mesmo se o usuário já estiver logado
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verified = params.get('verified');
    const verifyError = params.get('verify_error');
    const earlyToken = (window as any).__verifyToken as string | undefined;
    if (earlyToken) {
      delete (window as any).__verifyToken;
    }
    const fallbackToken = params.get('verify_fallback');
    const token = earlyToken || params.get('verify') || fallbackToken;

    // Se o script inline já processou e redirecionou com ?verified=1
    if (verified === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      setVerifyMsg('E-mail verificado com sucesso! Agora você pode fazer login.');
      setVerifyProcessing(false);
      return;
    }

    // Se houve erro na verificação pelo script inline
    if (verifyError === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      setVerifyMsg('Erro ao verificar e-mail. Tente novamente.');
      setVerifyProcessing(false);
      return;
    }

    if (!token) return;

    // Limpa a URL imediatamente
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    setVerifyProcessing(true);

    fetch(pb.baseURL + '/api/collections/amarcap53_users/confirm-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({ token }).toString(),
    })
      .then(async (resp) => {
        const text = await resp.text();
        console.log('[verify] Status:', resp.status, 'Body:', text);
        if (resp.ok || resp.status === 204) {
          setVerifyMsg('E-mail verificado com sucesso! Agora você pode fazer login.');
          // Se estava logado com conta não verificada, faz logout
          if (user && ((user as any).verified === false || (user as any).verified === 0)) {
            pb.authStore.clear();
            window.location.reload();
          }
        } else {
          let msg = '';
          try { msg = JSON.parse(text).message; } catch { msg = text; }
          if (msg.includes('expired') || msg.includes('expirado')) {
            setVerifyMsg('O link de verificação expirou. Solicite um novo cadastro.');
          } else if (msg.includes('already') || msg.includes('verificado') || msg.includes('Invalid')) {
            setVerifyMsg('E-mail já verificado. Você pode fazer login.');
          } else {
            setVerifyMsg('Erro ao verificar: ' + (msg || resp.statusText));
          }
        }
      })
      .catch((err) => {
        console.error('[verify] Erro de rede:', err);
        setVerifyMsg('Erro de conexão ao verificar e-mail.');
      })
      .finally(() => setVerifyProcessing(false));
  }, []);

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [setIsMobile]);

  // Loading inicial (antes de qualquer verificação)
  if (isLoading && !verifyMsg && !verifyProcessing) {
    return (
      <div className="min-h-dvh min-h-[100dvh] flex items-center justify-center bg-[#f0f2f5]">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#001b3d] to-[#003d7a] shadow-lg shadow-blue-900/20 flex items-center justify-center mx-auto mb-4">
            <Heart className="w-7 h-7 text-white" />
          </div>
          <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    );
  }

  // Tela de resultado de verificação de e-mail — PRIORIDADE MÁXIMA
  if (verifyMsg || verifyProcessing) {
    const isSuccess = verifyMsg && (verifyMsg.includes('sucesso') || verifyMsg.includes('já verificado'));
    const isError = verifyMsg && !isSuccess;

    return (
      <div className="min-h-dvh min-h-[100dvh] flex flex-col font-sans bg-[#f0f2f5]">
        {/* Brand Panel — Desktop */}
        <div className="hidden lg:flex lg:w-1/2 fixed inset-0 left-0 w-1/2 z-0 overflow-hidden bg-gradient-to-br from-[#001b3d] via-[#002b5c] to-[#003d7a]">
          <div className="absolute inset-0">
            <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-[floatSlow_20s_ease-in-out_infinite]" />
            <div className="absolute bottom-20 -right-20 w-[30rem] h-[30rem] bg-blue-400/5 rounded-full blur-3xl animate-[floatSlow_25s_ease-in-out_infinite_reverse]" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-60" />
          </div>
          <div className="relative z-10 flex flex-col justify-center px-12 xl:px-16 2xl:px-20 py-6 lg:py-8 xl:py-10 w-full">
            <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6 xl:mb-8 animate-[fadeSlideIn_0.6s_ease-out_0.2s_both]">
              <div className="w-10 h-10 lg:w-12 lg:h-12 xl:w-14 xl:h-14 rounded-[0.875rem] lg:rounded-[1rem] bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-black/10 ring-1 ring-white/10">
                <Heart className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl lg:text-2xl xl:text-3xl font-black text-white tracking-tight">AMAR</h1>
                <p className="text-blue-200/70 text-[9px] lg:text-[10px] xl:text-[11px] font-bold uppercase tracking-[0.2em] mt-0.5">ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO</p>
              </div>
            </div>
            <div className="space-y-2.5 lg:space-y-3 xl:space-y-4 mb-4 lg:mb-6 xl:mb-8 animate-[fadeSlideIn_0.6s_ease-out_0.4s_both]">
              <h2 className="text-2xl lg:text-2xl xl:text-3xl 2xl:text-4xl font-black text-white leading-[1.05] tracking-tight">
                Acompanhamento<br />
                <span className="text-blue-300 bg-gradient-to-r from-blue-300 to-blue-200 bg-clip-text text-transparent">que salva vidas</span>
              </h2>
              <p className="text-blue-200/70 text-[13px] lg:text-sm font-medium leading-snug max-w-md">
                Plataforma integrada para gestão e monitoramento de pacientes no rastreamento do câncer do colo do útero.
              </p>
            </div>
            <div className="mt-auto pt-6 lg:pt-8 xl:pt-12 border-t border-white/[0.07] animate-[fadeSlideIn_0.6s_ease-out_1s_both]">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <div className="w-px h-3 bg-blue-400/40" />
                  <p className="text-blue-200/55 text-[9px] font-bold uppercase tracking-[0.15em]">Coordenadoria Geral de Atenção Primária — AP 5.3</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-px h-2.5 bg-blue-400/25" />
                  <p className="text-blue-300/35 text-[9px] font-semibold tracking-[0.2em]">© 2026 AMAR — Todos os direitos reservados</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Panel */}
        <div className="relative z-10 w-full lg:w-1/2 lg:ml-auto flex flex-col min-h-dvh min-h-[100dvh] overflow-y-auto overscroll-contain">
          <div className="flex-1 flex items-center justify-center px-4 py-4 sm:px-6 md:px-8 lg:px-10 xl:px-14 2xl:px-16"
            style={{ paddingTop: 'max(1rem, env(safe-area-inset-top, 1rem))', paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>
            <div className="w-full max-w-[440px] lg:max-w-[380px] xl:max-w-[400px] 2xl:max-w-[420px]">

              {/* Mobile Logo */}
              <div className="lg:hidden flex flex-col items-center mb-4 sm:mb-8 animate-[fadeSlideIn_0.5s_ease-out]">
                <div className="w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-[1rem] sm:rounded-[1.25rem] bg-gradient-to-br from-[#001b3d] to-[#003d7a] flex items-center justify-center shadow-lg shadow-blue-900/20 ring-1 ring-white/10 mb-2.5 sm:mb-4">
                  <Heart className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
                </div>
                <h1 className="text-[1.375rem] sm:text-[1.625rem] font-black text-[#001b3d] tracking-tight">AMAR</h1>
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 text-center max-w-[260px] sm:max-w-[300px] leading-snug">ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO</p>
              </div>

              {/* Action Card — Premium glassmorphism */}
              <div className="bg-white/80 sm:bg-white backdrop-blur-xl sm:backdrop-blur-none rounded-[1.25rem] sm:rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:shadow-[0_25px_80px_rgba(0,0,0,0.12)] border border-white/60 sm:border-slate-200/50 lg:border-slate-200/60 p-4 sm:p-6 md:p-8 lg:p-7 xl:p-8 relative overflow-hidden animate-[fadeSlideIn_0.6s_ease-out_0.1s_both]">
                {/* Top gradient bar */}
                <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-[#001b3d] to-blue-500" />

                {/* ── VERIFY PROCESSING ── */}
                {verifyProcessing && !verifyMsg && (
                  <div className="flex flex-col items-center text-center animate-[fadeSlideIn_0.4s_ease-out]">
                    <div className="relative mb-5">
                      <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#001b3d] to-[#002b5c] shadow-lg shadow-blue-900/20 flex items-center justify-center">
                        <Mail className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                      </div>
                      <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30">
                        <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      </div>
                    </div>
                    <h2 className="text-lg sm:text-xl lg:text-xl font-black text-[#001b3d] tracking-tight mb-1.5">Verificando seu e-mail</h2>
                    <p className="text-[11px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest leading-relaxed">Aguarde enquanto confirmamos<br className="hidden sm:block" /> seu endereço</p>
                    {/* Animated dots */}
                    <div className="flex items-center gap-1.5 mt-5">
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-[pulse_1.4s_ease-in-out_infinite]" />
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-[pulse_1.4s_ease-in-out_0.2s_infinite]" />
                      <span className="w-2 h-2 rounded-full bg-blue-400 animate-[pulse_1.4s_ease-in-out_0.4s_infinite]" />
                    </div>
                  </div>
                )}

                {/* ── SUCCESS / ERROR ── */}
                {verifyMsg && (
                  <div className="flex flex-col items-center text-center animate-[fadeSlideIn_0.5s_ease-out]">
                    {/* Icon with glow ring */}
                    <div className="relative mb-5">
                      <div className={`absolute inset-0 rounded-3xl blur-xl opacity-40 ${
                        isSuccess ? 'bg-emerald-400' : 'bg-rose-400'
                      }`} />
                      <div className={`relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center shadow-lg transition-all duration-500 animate-[scaleIn_0.4s_ease-out] ${
                        isSuccess
                          ? 'bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-emerald-500/25'
                          : 'bg-gradient-to-br from-rose-400 to-rose-600 shadow-rose-500/25'
                      }`}>
                        {isSuccess
                          ? <CheckCircle2 className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                          : <AlertTriangle className="w-8 h-8 sm:w-10 sm:h-10 text-white" />
                        }
                      </div>
                    </div>

                    <h2 className="text-xl sm:text-2xl lg:text-2xl font-black text-[#001b3d] tracking-tight leading-tight mb-2">
                      {isSuccess ? 'E-mail Confirmado!' : 'Houve um Problema'}
                    </h2>
                    <p className={`text-[13px] sm:text-sm font-medium leading-relaxed mb-6 max-w-[320px] ${
                      isSuccess ? 'text-slate-500' : 'text-rose-600 font-semibold'
                    }`}>
                      {verifyMsg}
                    </p>

                    {isSuccess && (
                      <div className="w-full space-y-2.5 mb-5">
                        <div className="flex items-center gap-3 p-3 bg-emerald-50/80 border border-emerald-100 rounded-xl animate-[fadeSlideIn_0.5s_ease-out_0.2s_both]">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                          <p className="text-[11px] sm:text-xs font-bold text-emerald-700">Conta ativada com sucesso</p>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-blue-50/80 border border-blue-100 rounded-xl animate-[fadeSlideIn_0.5s_ease-out_0.35s_both]">
                          <Mail className="w-4 h-4 text-blue-500 shrink-0" />
                          <p className="text-[11px] sm:text-xs font-bold text-blue-700">Use seu e-mail e senha para acessar</p>
                        </div>
                      </div>
                    )}

                    {isError && (
                      <div className="w-full p-3 bg-rose-50/80 border border-rose-100 rounded-xl mb-5 animate-[shakeIn_0.4s_ease-out]">
                        <p className="text-[11px] sm:text-xs font-bold text-rose-600 leading-relaxed">
                          Caso o link tenha expirado, solicite um novo cadastro ou entre em contato com o administrador do sistema.
                        </p>
                      </div>
                    )}

                    <button
                      onClick={() => window.location.href = '/'}
                      className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isSuccess ? 'Acessar o Sistema' : 'Voltar para o Login'}
                        <ArrowRight className="w-4 h-4" />
                      </span>
                    </button>
                  </div>
                )}

                {/* ── INITIAL LOADING (before verifyProcessing) ── */}
                {!verifyProcessing && !verifyMsg && (
                  <div className="flex flex-col items-center text-center py-6 animate-[fadeSlideIn_0.5s_ease-out]">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#001b3d] to-[#003d7a] shadow-lg shadow-blue-900/20 flex items-center justify-center mx-auto mb-4">
                      <Heart className="w-7 h-7 text-white" />
                    </div>
                    <div className="w-10 h-10 border-3 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="mt-4 sm:mt-6 lg:mt-5 flex flex-col items-center gap-3 sm:gap-6 lg:gap-4 animate-[fadeSlideIn_0.6s_ease-out_0.3s_both]">
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
              </div>
            </div>
          </div>
        </div>

        {/* Animations */}
        <style>{`
          @keyframes fadeSlideIn {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
          }
          @keyframes scaleIn {
            from { opacity: 0; transform: scale(0.8); }
            to { opacity: 1; transform: scale(1); }
          }
          @keyframes shakeIn {
            0% { opacity: 0; transform: translateY(-6px) scale(0.98); }
            40% { transform: translateY(2px) scale(1.005); }
            70% { transform: translateY(-1px) scale(1); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1.2); }
          }
          @keyframes floatSlow {
            0%, 100% { transform: translate(0, 0) scale(1); }
            33% { transform: translate(15px, -20px) scale(1.02); }
            66% { transform: translate(-10px, 10px) scale(0.98); }
          }
        `}</style>
      </div>
    );
  }

  // Email action (verify/reset/change) — renderiza ANTES do auth check
  // Garante que o link de troca de e-mail abra a página de senha, mesmo logado
  if (emailAction) {
    return <EmailActionPage action={emailAction.action} token={emailAction.token} />;
  }

  if (!user) {
    return (
      <>
        <AuthScreen />
        <InstallBanner />
      </>
    );
  }

  return (
    <div className="flex min-h-screen bg-surface text-on-surface overflow-hidden relative">
      {/* Overlay for mobile when sidebar is open */}
      {isMobile && isOpen && (
        <div 
          className="sidebar-overlay"
          onClick={closeSidebar}
        />
      )}

      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      
      <main className={`flex-1 flex flex-col h-screen overflow-hidden transition-all duration-300`}>
        {activeTab === 'resumo' && <DashboardScreen key="resumo" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'pacientes' && <PatientsScreen key="pacientes" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'favoritos' && <FavoritesScreen key="favoritos" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'acompanhamento' && <FollowUpsScreen key="acompanhamento" activeTab={activeTab} setActiveTab={setActiveTab} />}
        {activeTab === 'configuracoes' && <SettingsScreen key="configuracoes" activeTab={activeTab} setActiveTab={setActiveTab} />}
      </main>
      <InstallBanner />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SidebarProvider>
        <AppContent />
      </SidebarProvider>
    </AuthProvider>
  );
}


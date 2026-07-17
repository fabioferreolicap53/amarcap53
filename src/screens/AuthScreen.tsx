import React, { useState, useRef } from 'react';
import { pb } from '../lib/pocketbase';
import { Activity, Mail, Lock, Building, Users, MapPin, ArrowRight, ArrowLeft, Eye, EyeOff, Shield, Heart, BadgeCheck } from 'lucide-react';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';

type AuthState = 'login' | 'register' | 'forgot_password';

export function AuthScreen() {
  const [authState, setAuthState] = useState<AuthState>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const submittingRef = useRef(false); // Previne double-submit

  const appConfig = {
    name: 'AMAR',
    description: 'ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO',
    collection: 'amarcap53_users',
    icon: <Activity className="h-8 w-8 text-white" />,
  };

  const authCollection = appConfig.collection;
  const showRegister = true;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [perfil, setPerfil] = useState('');
  const [unidadeSaude, setUnidadeSaude] = useState('');
  const [equipe, setEquipe] = useState('');
  const [microarea, setMicroarea] = useState('');

  const clearMessages = () => {
    setError(null);
    setSuccessMsg(null);
    setPassword('');
    setPasswordConfirm('');
    setShowPassword(false);
    setShowPasswordConfirm(false);
  };

  const toggleShowPassword = () => setShowPassword(!showPassword);
  const toggleShowPasswordConfirm = () => setShowPasswordConfirm(!showPasswordConfirm);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    clearMessages();
    try {
      const authData = await pb.collection('amarcap53_users').authWithPassword(email, password);

      // Verifica se o e-mail foi confirmado (campo verified do PocketBase)
      if (authData && authData.record && authData.record.verified === false) {
        pb.authStore.clear();
        setError('E-mail não confirmado. Verifique sua caixa de entrada (e SPAM) e confirme o link antes de fazer login.');
        return;
      }
    } catch (err: any) {
      console.error(err);
      setError('Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    clearMessages();
    try {
      if (password !== passwordConfirm) {
        setError('As senhas não coincidem.');
        setIsLoading(false);
        return;
      }
      if (!perfil) {
        setError('Selecione um perfil de acesso.');
        setIsLoading(false);
        return;
      }
      if (perfil !== 'cap' && !unidadeSaude) {
        setError('Selecione a unidade de saúde.');
        setIsLoading(false);
        return;
      }
      if ((perfil === 'equipe' || perfil === 'microarea') && !equipe) {
        setError('Selecione a equipe.');
        setIsLoading(false);
        return;
      }
      if (perfil === 'microarea' && !microarea) {
        setError('Selecione a microárea.');
        setIsLoading(false);
        return;
      }

      const finalUnidade = perfil === 'cap' ? '' : unidadeSaude.trim();
      const finalEquipe = (perfil === 'cap' || perfil === 'unidade') ? '' : equipe.trim();
      const finalMicroarea = perfil === 'microarea' ? microarea.trim() : 'N/A';

      // Escapa aspas duplas para filtro PocketBase
      const esc = (v: string) => v.replace(/"/g, '\\"');

      // Verifica duplicidade via query leve (getFirstListItem com fields:'id')
      const checkDuplicate = async (filter: string) => {
        try {
          const existing = await pb.collection('amarcap53_users').getFirstListItem(filter, { fields: 'id', requestKey: null });
          return !!existing;
        } catch {
          return false; // 404 = não encontrado = não duplicado
        }
      };

      // 1. Verifica email duplicado
      if (await checkDuplicate(`email="${esc(email)}"`)) {
        setError('Este e-mail já está sendo utilizado por outro usuário.');
        setIsLoading(false);
        return;
      }

      // 2. Verifica combinação role + unidade + equipe + microárea
      let comboFilter = '';
      if (perfil === 'cap') {
        comboFilter = 'role="cap"';
      } else if (perfil === 'unidade') {
        comboFilter = `role="unidade" && unidade_saude="${esc(finalUnidade)}"`;
      } else if (perfil === 'equipe') {
        comboFilter = `role="equipe" && unidade_saude="${esc(finalUnidade)}" && equipe="${esc(finalEquipe)}"`;
      } else if (perfil === 'microarea') {
        comboFilter = `role="microarea" && unidade_saude="${esc(finalUnidade)}" && equipe="${esc(finalEquipe)}" && microarea="${esc(finalMicroarea)}"`;
      }

      if (comboFilter && await checkDuplicate(comboFilter)) {
        let msg = 'Já existe um cadastro com esta combinação.';
        if (perfil === 'cap') msg = 'Já existe um usuário cadastrado para a Coordenação (CAP).';
        else if (perfil === 'unidade') msg = `Já existe um gestor cadastrado para a unidade "${finalUnidade}".`;
        else if (perfil === 'equipe') msg = `Já existe um enfermeiro/médico cadastrado para a equipe "${finalEquipe}" da unidade "${finalUnidade}".`;
        else if (perfil === 'microarea') msg = `Já existe um agente cadastrado para a microárea "${finalMicroarea}" da equipe "${finalEquipe}" na unidade "${finalUnidade}".`;
        setError(msg);
        setIsLoading(false);
        return;
      }

      // Criação via SDK padrão
      const data: Record<string, any> = {
        username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + Math.floor(Math.random() * 10000),
        email,
        emailVisibility: true,
        password,
        passwordConfirm,
        unidade_saude: finalUnidade,
        equipe: finalEquipe,
        role: perfil,
        microarea: finalMicroarea
      };

      await pb.collection('amarcap53_users').create(data);

      // Envio de verificação de e-mail
      try {
        await pb.collection('amarcap53_users').requestVerification(email);
      } catch (verifyErr) {
        console.warn('Verificação já enviada ou erro silencioso:', verifyErr);
      }

      setSuccessMsg('Cadastro realizado! Verifique seu e-mail (e a caixa de SPAM) para ativar a conta.');
      setAuthState('login');
    } catch (err: any) {
      console.error('Erro detalhado:', err?.data || err);

      const msg = err?.data?.message || err?.message || '';

      // Erro de duplicata do hook server-side
      if (msg.includes('combinação') || msg.includes('Coordenação') || msg.includes('gestor') || msg.includes('enfermeiro') || msg.includes('agente')) {
        setError(msg);
      } else if (err?.status === 400 && err?.data?.data) {
        const firstField = Object.keys(err.data.data)[0];
        const fieldError = err.data.data[firstField];
        const fieldMsg = String(fieldError?.message || '').toLowerCase();
        if (fieldMsg.includes('unique') || fieldMsg.includes('unique')) {
          setError('Já existe um cadastro com esta combinação de perfil e localização.');
        } else {
          setError(`Erro no campo ${firstField}: ${fieldError.message}`);
        }
      } else if (msg.includes('unique') || msg.includes('Unique')) {
        setError('Já existe um cadastro com esta combinação de perfil e localização.');
      } else {
        setError(msg || 'Erro ao criar conta. Verifique os dados.');
      }
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    clearMessages();
    try {
      await pb.collection('amarcap53_users').requestPasswordReset(email);
      setSuccessMsg('Se o e-mail estiver cadastrado, você receberá um link de recuperação. Verifique também sua caixa de SPAM.');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao solicitar recuperação. Tente novamente mais tarde.');
    } finally {
      submittingRef.current = false;
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-dvh min-h-[100dvh] flex flex-col font-sans bg-[#f0f2f5]">
      {/* Brand Panel — Desktop */}
      <div className="hidden lg:flex lg:w-1/2 fixed inset-0 left-0 w-1/2 z-0 overflow-hidden bg-gradient-to-br from-[#001b3d] via-[#002b5c] to-[#003d7a]">
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-[floatSlow_20s_ease-in-out_infinite]" />
          <div className="absolute bottom-20 -right-20 w-[30rem] h-[30rem] bg-blue-400/5 rounded-full blur-3xl animate-[floatSlow_25s_ease-in-out_infinite_reverse]" />
          <div className="absolute top-1/3 right-10 w-64 h-64 bg-white/[0.02] rounded-full blur-2xl" />
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px] opacity-60" />
          {/* Subtle radial glow */}
          <div className="absolute top-1/4 left-1/3 w-[500px] h-[500px] bg-blue-400/[0.03] rounded-full blur-[100px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-16 xl:px-20 py-12 w-full">
          {/* Logo — staggered entrance */}
          <div className="flex items-center gap-5 mb-16 animate-[fadeSlideIn_0.6s_ease-out_0.2s_both]">
            <div className="w-16 h-16 rounded-[1.25rem] bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-black/10 ring-1 ring-white/10 hover:bg-white/15 hover:scale-105 transition-all duration-300">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">{appConfig.name}</h1>
              <p className="text-blue-200/70 text-[11px] xl:text-xs font-bold uppercase tracking-[0.2em] mt-1">ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO</p>
            </div>
          </div>

          {/* Tagline — staggered */}
          <div className="space-y-6 mb-16 animate-[fadeSlideIn_0.6s_ease-out_0.4s_both]">
            <h2 className="text-4xl xl:text-5xl font-black text-white leading-[1.1] tracking-tight">
              Acompanhamento
              <br />
              <span className="text-blue-300 bg-gradient-to-r from-blue-300 to-blue-200 bg-clip-text text-transparent">que salva vidas</span>
            </h2>
            <p className="text-blue-200/70 text-[0.9375rem] font-medium leading-relaxed max-w-md">
              Plataforma integrada para gestão e monitoramento de pacientes no rastreamento do câncer do colo do útero.
            </p>
          </div>

          {/* Features — staggered with hover */}
          <div className="space-y-4 animate-[fadeSlideIn_0.6s_ease-out_0.6s_both]">
            {[
              { icon: BadgeCheck, text: 'Gestão de pacientes por território', delay: '0.7s' },
              { icon: Activity, text: 'Rastreamento de exames em tempo real', delay: '0.8s' },
              { icon: Shield, text: 'Dados seguros e centralizados', delay: '0.9s' },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-center gap-3 group p-2 -ml-2 rounded-xl hover:bg-white/[0.04] transition-all duration-300 cursor-default"
                style={{ animationDelay: item.delay }}
              >
                <div className="w-10 h-10 rounded-xl bg-white/[0.06] flex items-center justify-center ring-1 ring-white/[0.06] group-hover:bg-white/[0.1] group-hover:ring-white/[0.12] group-hover:scale-110 transition-all duration-300">
                  <item.icon className="w-[18px] h-[18px] text-blue-300 group-hover:text-blue-200 transition-colors" />
                </div>
                <span className="text-[0.9375rem] font-medium text-blue-200/80 group-hover:text-blue-100/90 transition-colors">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Footer — improved contrast */}
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

      {/* Form Panel — Scrollable for virtual keyboard */}
      <div className="relative z-10 w-full lg:w-1/2 lg:ml-auto flex flex-col min-h-dvh min-h-[100dvh] overflow-y-auto overscroll-contain [-webkit-overflow-scrolling:touch]">
        <div
          className="flex-1 flex items-center justify-center px-4 py-6 sm:px-8 md:px-10 lg:px-14 xl:px-16"
          style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top, 1.5rem))', paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}
        >
          <div className="w-full max-w-[440px] lg:max-w-[400px] xl:max-w-[420px]">
            {/* Mobile logo — compacto */}
            <div className="lg:hidden flex flex-col items-center mb-5 sm:mb-10 animate-[fadeSlideIn_0.5s_ease-out]">
              <div className="w-14 h-14 sm:w-[4.5rem] sm:h-[4.5rem] rounded-[1rem] sm:rounded-[1.25rem] bg-gradient-to-br from-[#001b3d] to-[#003d7a] flex items-center justify-center shadow-lg shadow-blue-900/20 ring-1 ring-white/10 mb-2.5 sm:mb-4">
                <Heart className="w-7 h-7 sm:w-9 sm:h-9 text-white" />
              </div>
              <h1 className="text-[1.375rem] sm:text-[1.625rem] font-black text-[#001b3d] tracking-tight leading-tight">{appConfig.name}</h1>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 text-center max-w-[260px] sm:max-w-[300px] leading-snug sm:leading-relaxed">{appConfig.description}</p>
            </div>

            {/* Form Card — Premium glassmorphism */}
            <div
              className="bg-white/80 sm:bg-white backdrop-blur-xl sm:backdrop-blur-none rounded-[1.25rem] sm:rounded-[2rem] shadow-[0_8px_40px_rgba(0,0,0,0.06)] sm:shadow-[0_20px_60px_rgba(0,0,0,0.08)] lg:shadow-[0_25px_80px_rgba(0,0,0,0.12)] border border-white/60 sm:border-slate-200/50 lg:border-slate-200/60 p-5 sm:p-8 md:p-10 relative overflow-hidden animate-[fadeSlideIn_0.6s_ease-out_0.1s_both]"
            >
              {/* Top gradient bar */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 via-[#001b3d] to-blue-500" />

              {/* Header */}
              <div className="mb-4 sm:mb-8">
                <h2 className="text-lg sm:text-[1.375rem] md:text-2xl lg:text-[1.625rem] font-black text-[#001b3d] tracking-tight leading-tight">
                  {authState === 'login' && 'Bem-vindo de volta'}
                  {authState === 'register' && 'Solicitar Acesso'}
                  {authState === 'forgot_password' && 'Recuperar Senha'}
                </h2>
                <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest mt-1.5 sm:mt-2 leading-snug sm:leading-relaxed">
                  {authState === 'login' && 'Acesse sua conta'}
                  {authState === 'register' && 'Preencha os dados para criar sua conta'}
                  {authState === 'forgot_password' && 'Enviaremos um link de recuperação'}
                </p>
              </div>

              {/* Messages */}
              {error && (
                <div className="mb-3 sm:mb-6 p-3 sm:p-4 bg-rose-50/80 backdrop-blur-sm border border-rose-100 rounded-xl sm:rounded-2xl flex items-start gap-2.5 sm:gap-3 animate-[shakeIn_0.4s_ease-out]">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-rose-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-rose-500/30">
                    <span className="text-white text-[10px] sm:text-[11px] font-black">!</span>
                  </div>
                  <p className="text-[11px] sm:text-xs font-bold text-rose-700 leading-snug sm:leading-relaxed">{error}</p>
                </div>
              )}

              {successMsg && (
                <div className="mb-3 sm:mb-6 p-3 sm:p-4 bg-emerald-50/80 backdrop-blur-sm border border-emerald-100 rounded-xl sm:rounded-2xl flex items-start gap-2.5 sm:gap-3 animate-[fadeSlideIn_0.4s_ease-out]">
                  <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5 shadow-sm shadow-emerald-500/30">
                    <BadgeCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                  </div>
                  <p className="text-[11px] sm:text-xs font-bold text-emerald-700 leading-snug sm:leading-relaxed">{successMsg}</p>
                </div>
              )}

              {/* Login Form */}
              {authState === 'login' && (
                <form className="space-y-3.5 sm:space-y-5" onSubmit={handleLogin}>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">E-mail de acesso</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-[18px] h-[18px] text-slate-400" />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 sm:py-3.5 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="voce@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Senha</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-[18px] h-[18px] text-slate-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 sm:py-3.5 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={toggleShowPassword}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center justify-center w-11 min-h-[48px] text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => { setAuthState('forgot_password'); clearMessages(); }}
                      className="text-[11px] font-black text-blue-600/60 hover:text-blue-600 active:text-blue-700 uppercase tracking-wider transition-colors min-h-[44px] flex items-center"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Entrando...
                      </span>
                    ) : 'Entrar'}
                  </button>
                </form>
              )}

              {/* Register Form */}
              {authState === 'register' && showRegister && (
                <form className="space-y-3.5 sm:space-y-4" onSubmit={handleRegister}>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Perfil de Acesso</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <Users className="w-[18px] h-[18px] text-slate-400" />
                      </div>
                      <select
                        required
                        value={perfil}
                        onChange={(e) => {
                          setPerfil(e.target.value);
                          setUnidadeSaude('');
                          setEquipe('');
                          setMicroarea('');
                        }}
                        className="w-full pl-10 pr-10 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 appearance-none"
                      >
                        <option value="" disabled>Selecione o Perfil</option>
                        <option value="microarea">ACS — Microárea</option>
                        <option value="equipe">Enfermeiro/Médico — Equipe</option>
                        <option value="unidade">Gestor — Unidade</option>
                        <option value="cap">Coordenação — CAP</option>
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <svg className="w-[18px] h-[18px] text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {(perfil === 'microarea' || perfil === 'equipe' || perfil === 'unidade') && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Unidade de Saúde</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <Building className="w-[18px] h-[18px] text-slate-400" />
                        </div>
                        <select
                          required
                          value={unidadeSaude}
                          onChange={(e) => {
                            setUnidadeSaude(e.target.value);
                            setEquipe('');
                            setMicroarea('');
                          }}
                          className="w-full pl-10 pr-10 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 appearance-none"
                        >
                          <option value="" disabled>Selecione a Unidade</option>
                          {Object.keys(UNIDADES_EQUIPES).map(unidade => (
                            <option key={unidade} value={unidade}>{unidade}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                          <svg className="w-[18px] h-[18px] text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {(perfil === 'microarea' || perfil === 'equipe') && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Equipe</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                          <Users className="w-[18px] h-[18px] text-slate-400" />
                        </div>
                        <select
                          required
                          value={equipe}
                          onChange={(e) => {
                            setEquipe(e.target.value);
                            setMicroarea('');
                          }}
                          disabled={!unidadeSaude}
                          className="w-full pl-10 pr-10 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>Selecione a Equipe</option>
                          {unidadeSaude && UNIDADES_EQUIPES[unidadeSaude]?.map(eq => (
                            <option key={eq} value={eq}>{eq}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                          <svg className="w-[18px] h-[18px] text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  {perfil === 'microarea' && (
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Microárea</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <MapPin className="w-[18px] h-[18px] text-slate-400" />
                        </div>
                        <select
                          required
                          value={microarea}
                          onChange={(e) => setMicroarea(e.target.value)}
                          disabled={!equipe}
                          className="w-full pl-10 pr-10 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="" disabled>Selecione a Microárea</option>
                          {MICROAREAS.map(ma => (
                            <option key={ma} value={ma}>{ma}</option>
                          ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                          <svg className="w-[18px] h-[18px] text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">E-mail de acesso</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-[18px] h-[18px] text-slate-400" />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="voce@exemplo.com"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Senha</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="w-full pl-9 pr-9 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.8125rem] sm:text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                          placeholder="Mín. 8"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={toggleShowPassword}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center justify-center w-10 min-h-[48px] text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Repetir</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                        </div>
                        <input
                          type={showPasswordConfirm ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          value={passwordConfirm}
                          onChange={(e) => setPasswordConfirm(e.target.value)}
                          className="w-full pl-9 pr-9 py-3 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.8125rem] sm:text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                          placeholder="Repetir"
                          minLength={8}
                        />
                        <button
                          type="button"
                          onClick={toggleShowPasswordConfirm}
                          className="absolute inset-y-0 right-0 pr-2.5 flex items-center justify-center w-10 min-h-[48px] text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors"
                        >
                          {showPasswordConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Cadastrando...
                      </span>
                    ) : 'Solicitar Acesso'}
                  </button>
                </form>
              )}

              {/* Forgot Password Form */}
              {authState === 'forgot_password' && (
                <form className="space-y-5" onSubmit={handleForgotPassword}>
                  <p className="text-[13px] text-slate-500 font-medium leading-relaxed bg-slate-50/80 p-4 rounded-xl sm:rounded-2xl border border-slate-100">
                    Digite seu e-mail de acesso cadastrado. Enviaremos um link seguro para redefinir sua senha.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">E-mail de acesso</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-[18px] h-[18px] text-slate-400" />
                      </div>
                      <input
                        type="email"
                        required
                        autoComplete="email"
                        inputMode="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 sm:py-3.5 min-h-[48px] bg-slate-50/80 border-2 border-slate-100 rounded-xl sm:rounded-2xl text-[0.9375rem] font-bold text-slate-700 outline-none focus:border-blue-500/30 focus:bg-white focus:ring-4 focus:ring-blue-500/5 transition-all duration-200 placeholder:text-slate-300"
                        placeholder="voce@exemplo.com"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3.5 min-h-[52px] bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl sm:rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 active:translate-y-0 active:shadow-md transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
                  >
                    {isLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Enviando...
                      </span>
                    ) : 'Enviar Link'}
                  </button>
                </form>
              )}

              {/* Footer Nav */}
              <div className="mt-5 sm:mt-8 pt-4 sm:pt-6 border-t border-slate-100">
                {authState === 'login' ? (
                  <p className="text-center">
                    <span className="text-[11px] sm:text-xs font-bold text-slate-400">Não possui conta? </span>
                    <button
                      onClick={() => { setAuthState('register'); clearMessages(); }}
                      className="text-[11px] sm:text-xs font-black text-[#001b3d] hover:text-blue-600 active:text-blue-700 transition-colors inline-flex items-center gap-1.5 min-h-[44px]"
                    >
                      Solicitar acesso <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </button>
                  </p>
                ) : (
                  <button
                    onClick={() => { setAuthState('login'); clearMessages(); }}
                    className="w-full flex items-center justify-center gap-2 text-[11px] sm:text-xs font-bold text-slate-400 hover:text-slate-600 active:text-slate-700 transition-colors min-h-[44px]"
                  >
                    <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Voltar para o login
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Footer */}
            <div className="flex flex-col items-center gap-4 sm:gap-8 mt-5 sm:mt-8 animate-[fadeSlideIn_0.6s_ease-out_0.3s_both]">
              <div className="flex-col gap-1.5 flex lg:hidden">
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

      {/* Premium Animations */}
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes shakeIn {
          0% { opacity: 0; transform: translateY(-6px) scale(0.98); }
          40% { transform: translateY(2px) scale(1.005); }
          70% { transform: translateY(-1px) scale(1); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatSlow {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(15px, -20px) scale(1.02); }
          66% { transform: translate(-10px, 10px) scale(0.98); }
        }
        @supports (padding: env(safe-area-inset-top)) {
          .min-h-dvh { padding-top: env(safe-area-inset-top); }
        }
      `}</style>
    </div>
  );
}

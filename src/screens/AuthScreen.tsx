import React, { useState } from 'react';
import { pb } from '../lib/pocketbase';
import { Activity, Mail, Lock, Building, Users, MapPin, ArrowRight, ArrowLeft, Eye, EyeOff, Shield, Heart, BadgeCheck } from 'lucide-react';
import { UNIDADES_EQUIPES, MICROAREAS } from '../constants/regionalData';

type AuthState = 'login' | 'register' | 'forgot_password';

export function AuthScreen() {
  const [authState, setAuthState] = useState<AuthState>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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
    setIsLoading(true);
    clearMessages();
    try {
      await pb.collection('amarcap53_users').authWithPassword(email, password);
    } catch (err: any) {
      console.error(err);
      setError('Credenciais inválidas. Verifique seu e-mail e senha.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
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

      const finalUnidade = perfil === 'cap' ? '' : unidadeSaude;
      const finalEquipe = (perfil === 'cap' || perfil === 'unidade') ? '' : equipe;
      const finalMicroarea = perfil === 'microarea' ? microarea : '';

      const existingEmail = await pb.collection('amarcap53_users').getFirstListItem(`email="${email}"`).catch(() => null);
      if (existingEmail) {
        setError('Este e-mail já está sendo utilizado por outro usuário.');
        setIsLoading(false);
        return;
      }

      let filterCondition = '';
      if (perfil === 'cap') {
        filterCondition = `unidade_saude="" && equipe="" && microarea=""`;
      } else if (perfil === 'unidade') {
        filterCondition = `unidade_saude="${finalUnidade}" && equipe="" && microarea=""`;
      } else if (perfil === 'equipe') {
        filterCondition = `unidade_saude="${finalUnidade}" && equipe="${finalEquipe}" && microarea=""`;
      } else if (perfil === 'microarea') {
        filterCondition = `unidade_saude="${finalUnidade}" && equipe="${finalEquipe}" && microarea="${finalMicroarea}"`;
      }

      const existingUser = await pb.collection('amarcap53_users').getFirstListItem(filterCondition).catch(() => null);

      if (existingUser) {
        let msg = 'Já existe um cadastro com esta combinação.';
        if (perfil === 'cap') msg = 'Já existe um usuário cadastrado para a Coordenação (CAP).';
        else if (perfil === 'unidade') msg = `Já existe um gestor cadastrado para a unidade "${finalUnidade}".`;
        else if (perfil === 'equipe') msg = `Já existe um enfermeiro/médico cadastrado para a equipe "${finalEquipe}" da unidade "${finalUnidade}".`;
        else if (perfil === 'microarea') msg = `Já existe um agente cadastrado para a microárea "${finalMicroarea}" da equipe "${finalEquipe}" na unidade "${finalUnidade}".`;
        
        setError(msg);
        setIsLoading(false);
        return;
      }

      const data = {
        username: email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_') + Math.floor(Math.random() * 10000),
        email,
        emailVisibility: true,
        password,
        passwordConfirm,
        unidade_saude: finalUnidade,
        equipe: finalEquipe,
        microarea: finalMicroarea,
        role: perfil
      };

      await pb.collection('amarcap53_users').create(data);
      
      try {
        await pb.collection('amarcap53_users').requestVerification(email);
      } catch (verifyErr) {
        console.warn('Verificação já enviada ou erro silencioso:', verifyErr);
      }
      
      setSuccessMsg('Cadastro realizado! Verifique seu e-mail (e a caixa de SPAM) para ativar a conta.');
      setAuthState('login');
    } catch (err: any) {
      console.error('Erro detalhado:', err.data);
      
      let msg = 'Erro ao criar conta. Verifique os dados.';
      
      if (err.data?.data) {
        const firstField = Object.keys(err.data.data)[0];
        const fieldError = err.data.data[firstField];
        msg = `Erro no campo ${firstField}: ${fieldError.message}`;
      } else if (err.message === 'Já existe um cadastro com esta combinação de perfil.') {
        msg = err.message;
      } else if (err.data?.message) {
        msg = err.data.message;
      }
      
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    clearMessages();
    try {
      await pb.collection('amarcap53_users').requestPasswordReset(email);
      setSuccessMsg('Se o e-mail estiver cadastrado, você receberá um link de recuperação. Verifique também sua caixa de SPAM.');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao solicitar recuperação. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex font-sans bg-[#f0f2f5]">
      {/* Brand Panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#001b3d] via-[#002b5c] to-[#003d7a]">
        {/* Decorative elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 -left-20 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-20 -right-20 w-[30rem] h-[30rem] bg-blue-400/5 rounded-full blur-3xl" />
          <div className="absolute top-1/3 right-10 w-64 h-64 bg-white/[0.02] rounded-full blur-2xl" />
          {/* Grid pattern */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:60px_60px]" />
        </div>

        <div className="relative z-10 flex flex-col justify-center px-20 py-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-5 mb-16">
            <div className="w-16 h-16 rounded-[1.25rem] bg-white/10 backdrop-blur-sm flex items-center justify-center shadow-lg shadow-black/10 ring-1 ring-white/10">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-black text-white tracking-tight">{appConfig.name}</h1>
              <p className="text-blue-200/60 text-xs font-bold uppercase tracking-[0.2em] mt-1">ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO</p>
            </div>
          </div>

          {/* Tagline */}
          <div className="space-y-6 mb-16">
            <h2 className="text-4xl md:text-5xl font-black text-white leading-[1.1] tracking-tight">
              Acompanhamento
              <br />
              <span className="text-blue-300">que salva vidas</span>
            </h2>
            <p className="text-blue-200/60 text-sm font-medium leading-relaxed max-w-md">
              Plataforma integrada para gestão e monitoramento de pacientes no rastreamento do câncer do colo do útero.
            </p>
          </div>

          {/* Feature list */}
          <div className="space-y-4">
            {[
              { icon: BadgeCheck, text: 'Gestão de pacientes por território' },
              { icon: Activity, text: 'Rastreamento de exames em tempo real' },
              { icon: Shield, text: 'Dados seguros e centralizados' },
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
                  <item.icon className="w-4 h-4 text-blue-300" />
                </div>
                <span className="text-sm font-medium text-blue-200/80">{item.text}</span>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-auto pt-20 border-t border-white/5">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <div className="w-px h-4 bg-blue-400/30" />
                <p className="text-blue-200/45 text-[9px] font-bold uppercase tracking-[0.15em]">Coordenadoria Geral de Atenção Primária — AP 5.3</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-px h-3 bg-blue-400/20" />
                <p className="text-blue-300/25 text-[9px] font-semibold tracking-[0.2em]">© 2026 AMAR — Todos os direitos reservados</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Form Panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo */}
          <div className="lg:hidden flex flex-col items-center mb-10">
            <div className="w-14 h-14 rounded-[1rem] bg-gradient-to-br from-[#001b3d] to-[#003d7a] flex items-center justify-center shadow-lg mb-4">
              <Heart className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-2xl font-black text-[#001b3d] tracking-tight">{appConfig.name}</h1>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1 text-center">{appConfig.description}</p>
          </div>

          {/* Form Card */}
          <div className="bg-white rounded-[2rem] shadow-[0_20px_60px_rgba(0,0,0,0.08)] border border-slate-200/50 p-8 sm:p-10 relative overflow-hidden">
            {/* Top gradient bar */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-500 via-[#001b3d] to-blue-500" />

            {/* Header */}
            <div className="mb-8">
              <h2 className="text-xl sm:text-2xl font-black text-[#001b3d] tracking-tight">
                {authState === 'login' && 'Bem-vindo de volta'}
                {authState === 'register' && 'Solicitar Acesso'}
                {authState === 'forgot_password' && 'Recuperar Senha'}
              </h2>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-2">
                {authState === 'login' && 'Acesse sua conta'}
                {authState === 'register' && 'Preencha os dados para criar sua conta'}
                {authState === 'forgot_password' && 'Enviaremos um link de recuperação'}
              </p>
            </div>

            {/* Messages */}
            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-rose-500 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-white text-[10px] font-black">!</span>
                </div>
                <p className="text-[11px] font-bold text-rose-700 leading-relaxed">{error}</p>
              </div>
            )}

            {successMsg && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-100 rounded-xl flex items-start gap-3">
                <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-white" />
                </div>
                <p className="text-[11px] font-bold text-emerald-700 leading-relaxed">{successMsg}</p>
              </div>
            )}

            {/* Login Form */}
            {authState === 'login' && (
              <form className="space-y-5" onSubmit={handleLogin}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">E-mail de acesso</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                      placeholder="voce@exemplo.com"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Senha</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Lock className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-11 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={toggleShowPassword}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-end">
                  <button
                    type="button"
                    onClick={() => { setAuthState('forgot_password'); clearMessages(); }}
                    className="text-[10px] font-black text-blue-600/60 hover:text-blue-600 uppercase tracking-wider transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
              <form className="space-y-4" onSubmit={handleRegister}>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Perfil de Acesso</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                      <Users className="w-4 h-4 text-slate-400" />
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
                      className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all appearance-none"
                    >
                      <option value="" disabled>Selecione o Perfil</option>
                      <option value="microarea">ACS — Microárea</option>
                      <option value="equipe">Enfermeiro/Médico — Equipe</option>
                      <option value="unidade">Gestor — Unidade</option>
                      <option value="cap">Coordenação — CAP</option>
                    </select>
                    <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                      <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                </div>

                {(perfil === 'microarea' || perfil === 'equipe' || perfil === 'unidade') && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Unidade de Saúde</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                        <Building className="w-4 h-4 text-slate-400" />
                      </div>
                      <select
                        required
                        value={unidadeSaude}
                        onChange={(e) => {
                          setUnidadeSaude(e.target.value);
                          setEquipe('');
                          setMicroarea('');
                        }}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all appearance-none"
                      >
                        <option value="" disabled>Selecione a Unidade</option>
                        {Object.keys(UNIDADES_EQUIPES).map(unidade => (
                          <option key={unidade} value={unidade}>{unidade}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {(perfil === 'microarea' || perfil === 'equipe') && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Equipe</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                        <Users className="w-4 h-4 text-slate-400" />
                      </div>
                      <select
                        required
                        value={equipe}
                        onChange={(e) => {
                          setEquipe(e.target.value);
                          setMicroarea('');
                        }}
                        disabled={!unidadeSaude}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>Selecione a Equipe</option>
                        {unidadeSaude && UNIDADES_EQUIPES[unidadeSaude]?.map(eq => (
                          <option key={eq} value={eq}>{eq}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                {perfil === 'microarea' && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Microárea</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none z-10">
                        <MapPin className="w-4 h-4 text-slate-400" />
                      </div>
                      <select
                        required
                        value={microarea}
                        onChange={(e) => setMicroarea(e.target.value)}
                        disabled={!equipe}
                        className="w-full pl-10 pr-10 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all appearance-none disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="" disabled>Selecione a Microárea</option>
                        {MICROAREAS.map(ma => (
                          <option key={ma} value={ma}>{ma}</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-0 pr-3.5 flex items-center pointer-events-none">
                        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">E-mail de acesso</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                      placeholder="voce@exemplo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Senha</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                        placeholder="Mín. 8"
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={toggleShowPassword}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">Repetir</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <input
                        type={showPasswordConfirm ? 'text' : 'password'}
                        required
                        value={passwordConfirm}
                        onChange={(e) => setPasswordConfirm(e.target.value)}
                        className="w-full pl-9 pr-9 py-2.5 bg-slate-50 border-2 border-transparent rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                        placeholder="Repetir"
                        minLength={8}
                      />
                      <button
                        type="button"
                        onClick={toggleShowPasswordConfirm}
                        className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 hover:text-slate-600"
                      >
                        {showPasswordConfirm ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
                <p className="text-xs text-slate-500 font-medium leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100">
                  Digite seu e-mail de acesso cadastrado. Enviaremos um link seguro para redefinir sua senha.
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.15em] ml-1">E-mail de acesso</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <Mail className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-transparent rounded-xl text-sm font-bold text-slate-700 outline-none focus:border-blue-500/20 focus:bg-white transition-all placeholder:text-slate-300"
                      placeholder="voce@exemplo.com"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3.5 bg-gradient-to-r from-[#001b3d] to-[#002b5c] text-white rounded-xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-blue-900/20 hover:shadow-xl hover:shadow-blue-900/30 hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
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
            <div className="mt-8 pt-6 border-t border-slate-100">
              {authState === 'login' ? (
                <p className="text-center">
                  <span className="text-[11px] font-bold text-slate-400">Não possui conta? </span>
                  <button
                    onClick={() => { setAuthState('register'); clearMessages(); }}
                    className="text-[11px] font-black text-[#001b3d] hover:text-blue-600 transition-colors inline-flex items-center gap-1"
                  >
                    Solicitar acesso <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </p>
              ) : (
                <button
                  onClick={() => { setAuthState('login'); clearMessages(); }}
                  className="w-full flex items-center justify-center gap-2 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" /> Voltar para o login
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col items-center gap-8 mt-8">
            <div className="flex-col gap-2 flex lg:hidden">
              <div className="flex items-center gap-2 justify-center">
                <div className="w-px h-4 bg-slate-300/30" />
                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-[0.15em]">Coordenadoria Geral de Atenção Primária — AP 5.3</p>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <div className="w-px h-3 bg-slate-300/20" />
                <p className="text-slate-400/70 text-[9px] font-semibold tracking-[0.2em]">© 2026 AMAR — Todos os direitos reservados</p>
              </div>
            </div>
            <p className="text-slate-300 text-[9px] font-bold uppercase tracking-[0.25em] text-center">Desenvolvido por Fabio Ferreira de Oliveira — DAPS/CAP5.3</p>
          </div>
        </div>
      </div>
    </div>
  );
}

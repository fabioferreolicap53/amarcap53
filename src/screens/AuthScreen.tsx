import React, { useState } from 'react';
import { pb } from '../lib/pocketbase';
import { Activity, Mail, Lock, Building, Users, MapPin, ArrowRight, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const UNIDADES_EQUIPES: Record<string, string[]> = {
  "CF ALICE DE JESUS REGO": ["BAIXADINHA", "JESUÍTAS", "MERCADANTE", "NOVO CONDOMÍNIO"],
  "CF DEOLINDO COUTO": ["BONS AMIGOS", "DR. CONTINENTINO", "JAQUEIRA", "MARQUES DE ERVAL", "PEDRINHAS"],
  "CF EDSON ABDALLA SAAD": ["CENTRO CULTURAL", "MARCOLINA", "ESPERANÇA", "PALESTINA", "PRAÇA DO MAIA", "VETERANO"],
  "CF ERNANI DE PAIVA FERREIRA BRAGA": ["GUANDU E GUANDU", "GUANDU E LIBERDADE", "HORTO FLORESTAL", "JOÃO XXIII", "MIÉCIMO", "PADRE GUILHERME DECAMINADA", "SERAFIM VIEGAS", "VILLAGE ATLANTA"],
  "CF HELANDE DE MELLO GONÇALVES": ["JÚLIA MIGUEL", "PARQUE SÃO PAULO", "VIEIRAS"],
  "CF ILZO MOTTA DE MELLO": ["MARIA APARECIDA", "ROBERTO MORENA", "TRÊS PONTES"],
  "CF JAMIL HADDAD": ["AGAI", "ANDORINHAS", "AUSTIN", "COLINA", "IPEG"],
  "CF JOÃO BATISTA CHAGAS": ["ÁGUAS DA PRATA", "FUTURO", "NOVA ESPERANÇA", "OLINDINA", "VENDA DE VARANDA"],
  "CF JOSÉ ANTÔNIO CIRAUDO": ["MANOEL JÚLIO", "COQUEIRAL (C)", "AURORA", "SÃO DOMINGOS SÁVIO", "VITOR DUMAS", "SÃO BENEDITO", "AREIA BRANCA"],
  "CF LENICE MARIA MONTEIRO COELHO": ["BOA ESPERANÇA", "LOTE 14", "PARQUE DAS PEDRAS", "SAQUASSU"],
  "CF LOURENÇO DE MELLO": ["ALZIRA GENI", "ALZIRA MARTINHO", "BAIRRO FARIAS"],
  "CF SAMUEL PENHA VALLE": ["ALTA", "TORRE", "VAGÃO"],
  "CF SÉRGIO AROUCA": ["BOA VISTA", "BODEGÃO", "CAMPEIRO MOR", "GENERAL OLÍMPIO", "IMPÉRIO", "JARDIM ITÁ"],
  "CF VALÉRIA GOMES ESTEVES": ["PIAI", "PEDRO LEITÃO", "BARREIRA", "EUCALIPAL", "BALNEÁRIO GLOBO"],
  "CF WALDEMAR BERARDINELLI": ["AMAZONAS", "AREAL", "COQUEIRAL (W)", "ILHA DO TATU", "IPIRANGA", "MIRANTE", "TRÊS PODERES", "TRIUNFO"],
  "CMS ADELINO SIMÕES": ["DIAMANTE", "ESMERALDA", "RUBI", "SAFIRA", "TOPÁZIO"],
  "CMS ALOYSIO AMÂNCIO DA SILVA": ["MORRO DO AR"],
  "CMS CATTAPRETA": ["ALVORADA", "CHATUBA", "CONJUNTO 61"],
  "CMS CESÁRIO DE MELO": ["CARVALHAU", "FELIPE CARDOSO", "MARQUES", "BLASO", "CURRAL FALSO", "TASSO", "VERIDIANA"],
  "CMS CYRO DE MELLO": ["JOÃO DE BARRO", "NOVA ÍNDIA", "PARAÍSO"],
  "CMS DÉCIO AMARAL FILHO": ["BARRO VERMELHO", "MAESTRO OLÍMPIO", "URUCÂNIA", "BAMBUZAL", "VALE DOS PALMARES"],
  "CMS EMYDIO CABRAL": ["1º DE ABRIL", "DR. HÉLIO RIBEIRO", "GOUVEIA", "MONTE DAS OLIVEIRAS", "MONTE SINAI"],
  "CMS FLORIPES GALDINO PEREIRA": ["SAGRADO CORAÇÃO", "NOVO HORIZONTE"],
  "CMS MARIA APARECIDA DE ALMEIDA": ["CESARINHO"],
  "CMS SÁVIO ANTUNES": ["CAMPO DOS BANDEIRANTES", "PONTE AMARELA", "SEMPRE VIDA"],
  "FORA DE ÁREA": ["NÃO SE APLICA"]
};

const MICROAREAS = ["01", "02", "03", "04", "05", "06"];

type AuthState = 'login' | 'register' | 'forgot_password';

export function AuthScreen() {
  const [authState, setAuthState] = useState<AuthState>('login');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
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
      // O App.tsx reage automaticamente à mudança no authStore via AuthContext
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

      // Check for duplicate combination of Unidade, Equipe and Microárea
      const existingUser = await pb.collection('amarcap53_users').getFirstListItem(
        `unidade_saude="${unidadeSaude}" && equipe="${equipe}" && microarea="${microarea}"`
      ).catch(() => null); // Catch error if not found (which is what we want)

      if (existingUser) {
        setError('Esta combinação de Unidade, Equipe e Microárea já está cadastrada.');
        setIsLoading(false);
        return;
      }

      const data = {
        email,
        password,
        passwordConfirm,
        unidade_saude: unidadeSaude,
        equipe,
        microarea,
      };

      await pb.collection('amarcap53_users').create(data);
      // Após criar, faz o login automaticamente
      await pb.collection('amarcap53_users').authWithPassword(email, password);
    } catch (err: any) {
      console.error(err);
      setError('Erro ao criar conta. Verifique os dados ou se o e-mail já existe.');
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
      setSuccessMsg('Se o e-mail estiver cadastrado, você receberá um link de recuperação.');
    } catch (err: any) {
      console.error(err);
      setError('Erro ao solicitar recuperação. Tente novamente mais tarde.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-surface flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-12 w-12 bg-primary/10 rounded-xl flex items-center justify-center">
            <Activity className="h-8 w-8 text-primary" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-on-surface tracking-tight">
          {authState === 'login' && 'Acesso ao Sistema'}
          {authState === 'register' && 'Criar Nova Conta'}
          {authState === 'forgot_password' && 'Recuperar Senha'}
        </h2>
        <p className="mt-2 text-center text-sm text-on-surface/60">
          AMARCAP 53
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-surface border border-outline/20 py-8 px-4 shadow-xl sm:rounded-2xl sm:px-10 relative overflow-hidden">
          {/* Subtle gradient background element for premium feel */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/40 via-primary to-primary/40"></div>
          
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm text-green-700">{successMsg}</p>
            </div>
          )}

          {authState === 'login' && (
            <form className="space-y-6" onSubmit={handleLogin}>
              <div>
                <label className="block text-sm font-medium text-on-surface/80">E-mail de acesso</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="voce@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface/80">Senha</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface/40 hover:text-on-surface/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="text-sm">
                  <button
                    type="button"
                    onClick={() => { setAuthState('forgot_password'); clearMessages(); }}
                    className="font-medium text-primary hover:text-primary/80 transition-colors"
                  >
                    Esqueceu a senha?
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Entrando...' : 'Entrar'}
              </button>
            </form>
          )}

          {authState === 'register' && (
            <form className="space-y-5" onSubmit={handleRegister}>
              <div>
                <label className="block text-sm font-medium text-on-surface/80">Unidade de Saúde</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <select
                    required
                    value={unidadeSaude}
                    onChange={(e) => {
                      setUnidadeSaude(e.target.value);
                      setEquipe('');
                      setMicroarea('');
                    }}
                    className="block w-full pl-10 pr-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-2.5 focus:ring-2 focus:ring-primary focus:border-primary transition-colors appearance-none"
                  >
                    <option value="" disabled>Selecione a Unidade</option>
                    {Object.keys(UNIDADES_EQUIPES).map(unidade => (
                      <option key={unidade} value={unidade}>{unidade}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="h-5 w-5 text-on-surface/40" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface/80">Equipe</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Users className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <select
                    required
                    value={equipe}
                    onChange={(e) => {
                      setEquipe(e.target.value);
                      setMicroarea('');
                    }}
                    disabled={!unidadeSaude}
                    className="block w-full pl-10 pr-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-2.5 focus:ring-2 focus:ring-primary focus:border-primary transition-colors appearance-none disabled:opacity-50 disabled:bg-surface-variant"
                  >
                    <option value="" disabled>Selecione a Equipe</option>
                    {unidadeSaude && UNIDADES_EQUIPES[unidadeSaude]?.map(eq => (
                      <option key={eq} value={eq}>{eq}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="h-5 w-5 text-on-surface/40" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface/80">Microárea</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <MapPin className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <select
                    required
                    value={microarea}
                    onChange={(e) => setMicroarea(e.target.value)}
                    disabled={!equipe}
                    className="block w-full pl-10 pr-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-2.5 focus:ring-2 focus:ring-primary focus:border-primary transition-colors appearance-none disabled:opacity-50 disabled:bg-surface-variant"
                  >
                    <option value="" disabled>Selecione a Microárea</option>
                    {MICROAREAS.map(ma => (
                      <option key={ma} value={ma}>{ma}</option>
                    ))}
                  </select>
                  <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                    <svg className="h-5 w-5 text-on-surface/40" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface/80">E-mail de acesso</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-2.5 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="voce@exemplo.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface/80">Senha</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-10 pr-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-2.5 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="Mínimo 8 caracteres"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={toggleShowPassword}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface/40 hover:text-on-surface/60 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-on-surface/80">Repetir Senha</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <input
                    type={showPasswordConfirm ? 'text' : 'password'}
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="block w-full pl-10 pr-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-2.5 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="Repita sua senha"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={toggleShowPasswordConfirm}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-on-surface/40 hover:text-on-surface/60 transition-colors"
                  >
                    {showPasswordConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
              >
                {isLoading ? 'Cadastrando...' : 'Cadastrar'}
              </button>
            </form>
          )}

          {authState === 'forgot_password' && (
            <form className="space-y-6" onSubmit={handleForgotPassword}>
              <p className="text-sm text-on-surface/70 mb-4">
                Digite seu e-mail de acesso. Enviaremos um link para redefinir sua senha.
              </p>
              <div>
                <label className="block text-sm font-medium text-on-surface/80">E-mail de acesso</label>
                <div className="mt-1 relative rounded-md shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-on-surface/40" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-10 sm:text-sm bg-surface text-on-surface border border-outline/30 rounded-lg py-3 focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                    placeholder="voce@exemplo.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-outline/10">
            {authState === 'login' ? (
              <p className="text-center text-sm text-on-surface/70">
                Não possui conta?{' '}
                <button
                  onClick={() => { setAuthState('register'); clearMessages(); }}
                  className="font-medium text-primary hover:text-primary/80 transition-colors inline-flex items-center"
                >
                  Solicitar acesso <ArrowRight className="ml-1 h-4 w-4" />
                </button>
              </p>
            ) : (
              <button
                onClick={() => { setAuthState('login'); clearMessages(); }}
                className="w-full flex items-center justify-center text-sm font-medium text-on-surface/60 hover:text-on-surface transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" /> Voltar para o login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

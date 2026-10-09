import React from 'react';
import { Bell, Settings, Menu, X, Building, Users, MapPin, LayoutDashboard, LogOut, ClipboardList, Star, BadgeCheck, Ribbon, ArrowUpRight } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  title: string;
  pageTitle?: string;
  subtitle?: string;
  showAvatarDetails?: boolean;
  activeTab?: string;
  setActiveTab?: (tab: string) => void;
}

// Abreviação harmônica de unidade: remove prefixos ruidosos e sufixo padrão.
// Ex: "SMS CF HELANDE DE MELLO GONCALVES AP 53" → "HELANDE DE MELLO GONCALVES"
// Nome completo sempre disponível via tooltip (title).
const abbreviateUnidade = (name: unknown): string => {
  const full = String(name ?? '').trim();
  if (!full) return '';
  let s = full;
  s = s.replace(/^SMS\s+(CF|CMS)\s+/i, '');
  s = s.replace(/^CF\s+/i, '');
  s = s.replace(/^CMS\s+/i, '');
  s = s.replace(/\s+AP\s*53$/i, '').trim();
  return s || full;
};

export const Header: React.FC<HeaderProps> = ({ 
  title, 
  pageTitle, 
  subtitle, 
  showAvatarDetails = true,
  activeTab,
  setActiveTab
}) => {
  const { toggleSidebar, isOpen } = useSidebar();
  const { user, isAdmin, logout } = useAuth();

  const navItems = [
    { id: 'resumo', label: 'Resumo', shortLabel: 'Resumo', icon: LayoutDashboard },
    { id: 'pacientes', label: 'Pacientes', shortLabel: 'Pacientes', icon: Users },
    { id: 'favoritos', label: 'Favoritos', shortLabel: 'Fav.', icon: Star },
    { id: 'acompanhamento', label: 'Acompanhamentos', shortLabel: 'Acomp.', icon: ClipboardList },
  ];

  return (
    <header className="bg-gradient-to-r from-[#001b3d] to-[#002b5c] backdrop-blur-md shadow-[0px_8px_32px_rgba(0,0,0,0.3)] flex items-center w-full px-4 md:px-6 h-[80px] sticky top-0 z-40 border-b border-white/10">
      {/* Botão de Menu (Mobile/Tablet) */}
      <div className="flex lg:hidden items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 relative group border border-white/10"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          ) : (
            <Menu className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Logo - Visível em telas médias e grandes */}
      <div className="hidden sm:flex flex-col mx-4 lg:mr-4 xl:mr-6 lg:ml-0 shrink-0">
        <h1 className="font-black text-white tracking-tighter text-xl lg:text-2xl leading-none">
          AMAR
        </h1>
        <p className="hidden lg:block text-[8px] font-bold text-white/60 uppercase tracking-[0.1em] mt-1 border-l border-white/30 pl-2 max-w-[130px] xl:max-w-[150px] leading-tight">
          <span className="hd:hidden">Acompanhamento da Mulher</span>
          <span className="hidden hd:inline">Acompanhamento da Mulher nas Ações de Rastreio</span>
        </p>
      </div>

      {/* Informações Centrais (Mobile) - Ajustado para evitar sobreposição */}
      {user && (
        <div className="flex lg:hidden flex-1 flex-col items-center justify-center px-2 overflow-hidden min-w-0">
          {/* Unidade - Sempre visível para todos exceto talvez CAP se vazio */}
          {user.unidade_saude && (
            <div className="flex items-center gap-1.5 flex-gap-fallback w-full justify-center">
              <Building className="w-3.5 h-3.5 text-blue-300 shrink-0" />
              <span className="text-[10px] md:text-[12px] font-black text-white uppercase tracking-tight text-center">
                {user.unidade_saude}
              </span>
            </div>
          )}
          
          {(user.role === 'equipe' || user.role === 'microarea') && user.equipe && (
            <div className="flex items-center gap-2 md:gap-4 flex-gap-fallback mt-1">
              <div className="flex items-center gap-1.5 flex-gap-fallback">
                <Users className="w-3 h-3 text-white/50 shrink-0" />
                <span className="text-[9px] md:text-[11px] font-bold text-white/80 uppercase">
                  {user.equipe}
                </span>
              </div>
              
              {user.role === 'microarea' && user.microarea && (
                <>
                  <div className="w-1 h-1 rounded-full bg-white/20"></div>
                  <div className="flex items-center gap-1.5 flex-gap-fallback">
                    <MapPin className="w-3 h-3 text-white/50 shrink-0" />
                    <span className="text-[9px] md:text-[11px] font-bold text-white/80 uppercase">
                      MA: {user.microarea}
                    </span>
                  </div>
                </>
              )}
            </div>
          )}

          {/* CAP Badge - Mobile/Tablet */}
          {user.role === 'cap' && (
            <div className="flex items-center gap-2 flex-gap-fallback mt-2">
              <Building className="w-5 h-5 text-white/70" />
              <span className="text-[13px] font-black text-white/80 uppercase tracking-[0.15em]">Coordenação CAP5.3</span>
            </div>
          )}
        </div>
      )}

      {/* Estrutura Desktop */}
      <div className="hidden lg:flex items-center h-full flex-1 min-w-0">
        {/* Coluna: Nav + User Info */}
        <div className="flex items-center gap-3 lg:gap-4 xl:gap-6 flex-gap-fallback min-w-0 flex-1 h-full">
          {/* Navegação — sempre alinhada à esquerda até 1920px para nunca cortar pontas */}
          <nav className="flex items-center justify-start hd:justify-center gap-1 lg:gap-1.5 flex-gap-fallback overflow-x-auto no-scrollbar pb-1 min-w-0 scroll-smooth">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab?.(item.id)}
                  title={item.label}
                  className={`flex items-center gap-1.5 lg:gap-1.5 xl:gap-2 px-2 lg:px-2 xl:px-3.5 py-2 lg:py-2 xl:py-2.5 rounded-xl transition-all duration-300 whitespace-nowrap group shrink-0 ${
                    isActive
                      ? 'bg-white/10 text-white shadow-[0_0_15px_rgba(255,255,255,0.1)] border border-white/20'
                      : 'text-white/60 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <Icon className={`w-4 lg:w-4 xl:w-[18px] h-4 lg:h-4 xl:h-[18px] transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                  <span className="text-[10px] lg:text-xs xl:text-sm font-bold tracking-wide uppercase">
                    <span className="hd:hidden">{item.shortLabel}</span>
                    <span className="hidden hd:inline">{item.label}</span>
                  </span>
                </button>
              );
            })}

            {/* Link Externo — Outubro Rosa 2026 (tema Ministério da Saúde) */}
            <a
              href="https://amarcap53global.pages.dev/"
              target="_blank"
              rel="noopener noreferrer"
              title="Outubro Rosa 2026 (abre em nova aba)"
              className="group relative flex items-center gap-2 lg:gap-2 px-2 lg:px-2.5 xl:px-3.5 py-1.5 lg:py-2 rounded-xl whitespace-nowrap shrink-0 overflow-hidden border border-pink-400/40 bg-gradient-to-r from-pink-600/20 via-pink-400/20 to-fuchsia-500/15 hover:border-pink-300/70 hover:from-pink-600/35 hover:via-pink-400/35 hover:to-fuchsia-500/30 hover:shadow-[0_0_20px_rgba(236,0,140,0.45)] transition-all duration-300"
            >
              {/* Brilho que atravessa no hover */}
              <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1200ms] bg-gradient-to-r from-transparent via-white/25 to-transparent" />

              {/* Laço rosa — símbolo Outubro Rosa */}
              <Ribbon className="w-4 h-4 text-pink-300 shrink-0 group-hover:rotate-12 group-hover:scale-110 transition-transform duration-300" />

              <span className="text-[10px] lg:text-xs xl:text-sm font-black uppercase tracking-wide text-white whitespace-nowrap">
                <span className="hd:hidden">Outubro Rosa</span>
                <span className="hidden hd:inline">Outubro Rosa 2026</span>
              </span>

              {/* Seta decorativa — só em telas largas para não cortar */}
              <ArrowUpRight className="hidden hd:block w-3 h-3 text-pink-200/70 shrink-0 group-hover:text-pink-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-300" />

              {/* Ponto "ao vivo" */}
              <span className="absolute -top-px right-1.5 w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_8px_rgba(236,0,140,0.9)] animate-pulse" />
            </a>
          </nav>

          {/* Informações do Usuário */}
          {user && (
            <div className="hidden md:flex items-center gap-2 lg:gap-3 xl:gap-5 flex-gap-fallback min-w-0 border-l border-white/10 pl-2 lg:pl-3 xl:pl-5 h-full shrink-0">
              {/* Unidade */}
              {user.unidade_saude && (
                <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 flex-gap-fallback group/info min-w-0 max-w-[140px] lg:max-w-[210px] xl:max-w-[320px]">
                  <Building className="w-3.5 lg:w-3.5 xl:w-4 h-3.5 lg:h-3.5 xl:h-4 text-blue-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col min-w-0 leading-tight xl:leading-snug">
                    <span className="text-[7px] lg:text-[7px] xl:text-[8px] uppercase tracking-[0.2em] text-white/40 font-black group-hover/info:text-blue-300 transition-colors">Unidade</span>
                    <span
                      className="text-[9px] lg:text-[10px] xl:text-xs font-black text-white uppercase tracking-wide truncate"
                      title={user.unidade_saude}
                    >
                      {abbreviateUnidade(user.unidade_saude)}
                    </span>
                  </div>
                </div>
              )}

              {/* Equipe */}
              {(user.role === 'equipe' || user.role === 'microarea') && user.equipe && (
                <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 flex-gap-fallback group/info min-w-0 max-w-[100px] lg:max-w-[120px] xl:max-w-[160px]">
                  <Users className="w-3.5 lg:w-3.5 xl:w-4 h-3.5 lg:h-3.5 xl:h-4 text-purple-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col min-w-0 leading-tight xl:leading-snug">
                    <span className="text-[7px] lg:text-[7px] xl:text-[8px] uppercase tracking-[0.2em] text-white/40 font-black group-hover/info:text-purple-300 transition-colors">Equipe</span>
                    <span className="text-[9px] lg:text-[10px] xl:text-xs font-black text-white uppercase tracking-wide truncate">{user.equipe}</span>
                  </div>
                </div>
              )}

              {/* Microárea */}
              {user.role === 'microarea' && user.microarea && (
                <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 flex-gap-fallback group/info shrink-0">
                  <MapPin className="w-3.5 lg:w-3.5 xl:w-4 h-3.5 lg:h-3.5 xl:h-4 text-emerald-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col leading-tight xl:leading-snug">
                    <span className="text-[7px] lg:text-[7px] xl:text-[8px] uppercase tracking-[0.2em] text-white/40 font-black group-hover/info:text-emerald-300 transition-colors">MA</span>
                    <span className="text-[9px] lg:text-[10px] xl:text-xs font-black text-white uppercase tracking-wide">{user.microarea}</span>
                  </div>
                </div>
              )}

              {/* CAP */}
              {user.role === 'cap' && (
                <div className="flex items-center gap-1.5 lg:gap-2 xl:gap-2.5 flex-gap-fallback group/info shrink-0">
                  <Building className="w-3.5 lg:w-3.5 xl:w-4 h-3.5 lg:h-3.5 xl:h-4 text-amber-300 shrink-0 group-hover/info:scale-110 transition-transform" />
                  <div className="flex flex-col leading-tight xl:leading-snug">
                    <span className="text-[7px] lg:text-[7px] xl:text-[8px] uppercase tracking-[0.2em] text-white/40 font-black group-hover/info:text-amber-300 transition-colors">Perfil</span>
                    <span className="text-[9px] lg:text-[10px] xl:text-xs font-black text-white uppercase tracking-wide">COORDENAÇÃO</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Lado Direito — Perfil, Config, Logout */}
        <div className="flex items-center gap-2 md:gap-3 flex-gap-fallback h-full shrink-0 ml-2">
            <div className="flex items-center gap-2 md:gap-3 flex-gap-fallback pl-2 md:pl-3 xl:pl-4 border-l border-white/10 h-full">
            <div className="hidden sm:flex flex-col justify-center min-w-0">
              <p className="text-xs md:text-sm font-bold text-white leading-tight truncate max-w-[100px] xl:max-w-[160px]">
                {user?.name || user?.email?.split('@')[0]}
              </p>
              <div className="flex items-center gap-1 flex-gap-fallback mt-0.5">
                <BadgeCheck className="w-3 h-3 text-blue-300" />
                <span className="text-[8px] font-black text-blue-200/70 uppercase tracking-wider">{(user?.role === 'admin' || user?.role === 'cap') ? 'ADMIN' : user?.role?.toUpperCase()}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setActiveTab?.('configuracoes')}
            className="p-2 md:p-2.5 hover:bg-white/10 rounded-xl transition-all duration-300 text-white/60 hover:text-white group border border-transparent hover:border-white/20 shrink-0"
            title="Configurações"
          >
            <Settings className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
          </button>

          <button
            onClick={logout}
            className="p-2 md:p-2.5 hover:bg-red-500/20 rounded-xl transition-all duration-300 text-white/60 hover:text-red-400 group border border-transparent hover:border-red-500/30 shrink-0"
            title="Sair"
          >
            <LogOut className="w-4 h-4 md:w-5 md:h-5 group-hover:scale-110 transition-transform" />
          </button>
        </div>
      </div>
    </header>
  );
};

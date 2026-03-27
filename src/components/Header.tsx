import React from 'react';
import { Bell, Settings, Menu, X, Building, Users, MapPin } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

interface HeaderProps {
  title: string;
  pageTitle?: string;
  subtitle?: string;
  showAvatarDetails?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ title, pageTitle, subtitle, showAvatarDetails = true }) => {
  const { toggleSidebar, isOpen } = useSidebar();
  const { user } = useAuth();

  return (
    <header className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] backdrop-blur-xl shadow-[0px_8px_32px_rgba(0,0,0,0.15)] flex items-center w-full px-4 md:px-8 h-[72px] sticky top-0 z-40 border-b border-white/5">
      {/* Botão de Menu (Mobile) */}
      <div className="flex lg:hidden items-center">
        <button 
          onClick={toggleSidebar}
          className="p-2 hover:bg-white/10 rounded-lg transition-all duration-300 relative group"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          ) : (
            <Menu className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          )}
        </button>
      </div>

      {/* Informações Centrais (Mobile) */}
      {user && (
        <div className="flex lg:hidden flex-1 flex-col items-center justify-center px-2 overflow-hidden">
          <div className="flex items-center gap-1.5 w-full justify-center">
            <Building className="w-2.5 h-2.5 text-white/40" />
            <span className="text-[10px] font-bold text-white leading-none truncate max-w-[140px] text-center">
              {user.unidade_saude}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-medium text-white/60 leading-none truncate max-w-[100px]">
              {user.equipe}
            </span>
            <div className="w-0.5 h-0.5 rounded-full bg-white/20"></div>
            <span className="text-[9px] font-medium text-white/60 leading-none">
              MA: {user.microarea}
            </span>
          </div>
        </div>
      )}

      {/* Estrutura Desktop (Original mantida e aprimorada) */}
      <div className="hidden lg:flex items-center gap-4 h-full flex-1">
        <div className="flex flex-col lg:flex-row lg:items-center h-full">
          {user && (
            <div className="flex items-center gap-8 xl:gap-12 ml-4 xl:ml-6 h-full">
              <div className="flex items-center gap-3 group transition-all duration-300 cursor-default hover:bg-white/5 px-4 py-2 rounded-xl">
                <div className="flex items-center justify-center bg-white/10 p-2.5 rounded-lg group-hover:bg-white/20 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <Building className="w-5 h-5 text-white/90 group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] xl:text-[10px] uppercase tracking-[0.2em] text-white/50 font-black mb-0.5 group-hover:text-white/70 transition-colors">Unidade</span>
                  <span className="text-sm xl:text-[15px] font-bold text-white leading-none tracking-tight">{user.unidade_saude}</span>
                </div>
              </div>

              <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

              <div className="flex items-center gap-3 group transition-all duration-300 cursor-default hover:bg-white/5 px-4 py-2 rounded-xl">
                <div className="flex items-center justify-center bg-white/10 p-2.5 rounded-lg group-hover:bg-white/20 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <Users className="w-5 h-5 text-white/90 group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] xl:text-[10px] uppercase tracking-[0.2em] text-white/50 font-black mb-0.5 group-hover:text-white/70 transition-colors">Equipe</span>
                  <span className="text-sm xl:text-[15px] font-bold text-white leading-none tracking-tight">{user.equipe}</span>
                </div>
              </div>

              <div className="w-px h-12 bg-gradient-to-b from-transparent via-white/10 to-transparent"></div>

              <div className="flex items-center gap-3 group transition-all duration-300 cursor-default hover:bg-white/5 px-4 py-2 rounded-xl">
                <div className="flex items-center justify-center bg-white/10 p-2.5 rounded-lg group-hover:bg-white/20 transition-all shadow-[inset_0_1px_1px_rgba(255,255,255,0.2)]">
                  <MapPin className="w-5 h-5 text-white/90 group-hover:text-white transition-colors duration-300" strokeWidth={2} />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-[9px] xl:text-[10px] uppercase tracking-[0.2em] text-white/50 font-black mb-0.5 group-hover:text-white/70 transition-colors">Microárea</span>
                  <span className="text-sm xl:text-[15px] font-bold text-white leading-none tracking-tight">{user.microarea}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Lado Direito: Perfil (Mobile e Desktop) */}
      <div className="flex items-center h-full py-3">
        <div className="flex items-center gap-3 pl-4 border-l border-white/10 h-full hover:bg-white/5 px-3 rounded-xl transition-all cursor-pointer group">
          {showAvatarDetails && user && (
            <div className="text-right hidden md:flex flex-col justify-center">
              <p className="text-sm font-bold text-white leading-tight truncate max-w-[140px] group-hover:text-primary-container transition-colors">
                {user.name || user.email}
              </p>
            </div>
          )}
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-container to-primary flex items-center justify-center text-on-primary-container font-black text-sm ring-2 ring-white/10 group-hover:ring-white/30 shadow-lg transition-all duration-300 group-hover:scale-105">
            {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
      </div>
    </header>
  );
};

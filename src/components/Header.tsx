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
    <header className="bg-gradient-to-r from-[#1c2e4a] to-[#253c61] backdrop-blur-xl shadow-[0px_8px_32px_rgba(0,0,0,0.15)] flex justify-between items-center w-full px-4 md:px-8 h-[72px] sticky top-0 z-40 border-b border-white/5">
      <div className="flex items-center gap-2 md:gap-4 h-full">
        <button 
          onClick={toggleSidebar}
          className="lg:hidden p-2 hover:bg-white/10 rounded-lg transition-all duration-300 mr-1 relative group"
          aria-label="Toggle Menu"
        >
          {isOpen ? (
            <X className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          ) : (
            <Menu className="w-6 h-6 text-white group-hover:scale-110 transition-transform" />
          )}
        </button>

        <div className="flex flex-col lg:flex-row lg:items-center h-full">
          {/* Título da página em mobile/tablet */}
          {pageTitle && (
            <span className="lg:hidden font-bold font-headline text-white tracking-tight text-sm">
              {pageTitle}
            </span>
          )}
          
          {/* Destaque das informações do usuário logado na versão Desktop */}
          {user && (
            <div className="hidden lg:flex items-center gap-8 xl:gap-12 ml-6 xl:ml-10 h-full">
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
      
      <div className="flex items-center gap-2 md:gap-4 h-full py-3">
        
        <div className={`flex items-center gap-3 pl-4 md:pl-6 border-l border-white/10 ml-2 h-full hover:bg-white/5 px-3 rounded-xl transition-all cursor-pointer group`}>
          {showAvatarDetails && user && (
            <div className="text-right hidden md:flex flex-col justify-center">
              <p className="text-sm font-bold text-white leading-tight truncate max-w-[140px] group-hover:text-primary-container transition-colors">{user.name || user.email}</p>
              <div className="flex flex-col lg:hidden items-end gap-0.5 mt-0.5">
                <span className="text-[9px] font-bold text-white/40 uppercase leading-none">{user.unidade_saude}</span>
                <span className="text-[9px] font-bold text-white/40 uppercase leading-none">{user.equipe} • MA: {user.microarea}</span>
              </div>
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

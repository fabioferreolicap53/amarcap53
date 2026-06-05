import React from 'react';
import { LayoutDashboard, Users, Settings, HelpCircle, LogOut, X, Building, MapPin, ClipboardList, Star } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { isOpen, closeSidebar } = useSidebar();
  const { user, isAdmin, logout } = useAuth();
  
  const navItems = [
    { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
    { id: 'pacientes', label: 'Meus Pacientes', icon: Users },
    { id: 'favoritos', label: 'Favoritos', icon: Star },
    { id: 'acompanhamento', label: 'Acompanhamentos', icon: ClipboardList },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      closeSidebar();
    }
  };

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 z-50 bg-[#f2f4f6] dark:bg-slate-950 flex flex-col p-4 border-r border-transparent transition-transform duration-300 ease-in-out lg:hidden ${isOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex justify-between items-center mb-8 px-4">
        <div>
          <h1 className="font-black text-[#051934] dark:text-white tracking-tighter text-2xl leading-none">
            AMAR
          </h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.05em] leading-tight mt-1.5 border-l-2 border-[#051934] pl-2">
            Acompanhamento da Mulher nas Ações de Rastreio
          </p>
        </div>
        <button 
          onClick={closeSidebar}
          className="lg:hidden p-2 hover:bg-slate-200 rounded-md transition-colors"
        >
          <X className="w-5 h-5 text-slate-600" />
        </button>
      </div>
      
      <nav className="flex-1 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-md transition-all text-left ${
                isActive 
                  ? 'bg-gradient-to-r from-[#051934] to-[#1c2e4a] text-white shadow-sm border-l-4 border-[#051934]' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/50'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm tracking-wide font-medium font-body">{item.label}</span>
            </button>
          );
        })}
      </nav>
      
      <div className="mt-auto pt-4 space-y-4">
        {/* Perfil do Usuário Mobile */}
        {user && (
          <div className="px-2">
            <div className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#051934] to-[#1c2e4a] flex items-center justify-center text-white font-black text-sm shadow-md ring-1 ring-white/20">
                  {user.name?.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-black text-[#051934] dark:text-white leading-none truncate">
                    {user.name || user.email}
                  </p>
                  <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mt-1">
                    Profissional
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 text-error px-4 py-3.5 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-all text-left border border-transparent hover:border-red-100 dark:hover:border-red-500/20 group"
        >
          <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
          <span className="text-sm tracking-widest font-black uppercase">Sair do Sistema</span>
        </button>
      </div>
    </aside>
  );
};

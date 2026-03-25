import React from 'react';
import { LayoutDashboard, Users, ClipboardCheck, Settings, HelpCircle, LogOut, X } from 'lucide-react';
import { useSidebar } from '../contexts/SidebarContext';
import { useAuth } from '../contexts/AuthContext';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { isOpen, closeSidebar } = useSidebar();
  const { logout } = useAuth();
  
  const navItems = [
    { id: 'resumo', label: 'Resumo', icon: LayoutDashboard },
    { id: 'pacientes', label: 'Meus Pacientes', icon: Users },
    { id: 'acompanhamentos', label: 'Acompanhamentos Realizados', icon: ClipboardCheck },
    { id: 'configuracoes', label: 'Configurações', icon: Settings },
  ];

  const handleNavClick = (id: string) => {
    setActiveTab(id);
    if (window.innerWidth < 1024) {
      closeSidebar();
    }
  };

  return (
    <aside className={`fixed left-0 top-0 h-full w-64 z-50 bg-[#f2f4f6] dark:bg-slate-950 flex flex-col p-4 border-r border-transparent transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
      <div className="flex justify-between items-center mb-8 px-4">
        <div>
          <h1 className="font-black text-[#051934] dark:text-white tracking-tight text-sm leading-tight">
            AMAR - ACOMPANHAMENTO DA MULHER NAS AÇÕES DE RASTREIO
          </h1>
          <p className="text-xs tracking-wide font-medium font-body text-slate-500 mt-1">Rastreio de Saúde SUS</p>
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
      
      <div className="mt-auto pt-4 border-t border-outline-variant/20 space-y-1">
        <button 
          onClick={logout}
          className="w-full flex items-center gap-3 text-error px-4 py-3 hover:bg-slate-200/50 rounded-md transition-all text-left"
        >
          <LogOut className="w-5 h-5" />
          <span className="text-sm tracking-wide font-medium font-body">Sair</span>
        </button>
      </div>
    </aside>
  );
};

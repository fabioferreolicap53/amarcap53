/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
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
import { pb } from './lib/pocketbase';

function AppContent() {
  const [activeTab, setActiveTab] = useState(() => {
    localStorage.removeItem('activeTab');
    return 'resumo';
  });
  const { isOpen, closeSidebar, isMobile, setIsMobile } = useSidebar();
  const { user, isLoading } = useAuth();
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [verifyProcessing, setVerifyProcessing] = useState(false);

  // Processa verificação de e-mail ANTES de qualquer renderização
  // Funciona mesmo se o usuário já estiver logado
  useEffect(() => {
    const earlyToken = (window as any).__verifyToken as string | undefined;
    if (earlyToken) {
      delete (window as any).__verifyToken;
    }
    const params = new URLSearchParams(window.location.search);
    const token = earlyToken || params.get('verify');

    if (!token) return;

    // Limpa a URL imediatamente
    if (window.location.search) {
      window.history.replaceState({}, '', window.location.pathname + window.location.hash);
    }

    setVerifyProcessing(true);

    fetch('https://centraldedados.dev.br/api/verification/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ token }).toString(),
    })
      .then(async (resp) => {
        const text = await resp.text();
        console.log('[verify] Status:', resp.status, 'Body:', text);
        if (resp.ok || resp.status === 204) {
          setVerifyMsg('E-mail verificado com sucesso! Agora você pode fazer login.');
          // Se estava logado com conta não verificada, faz logout
          if (user && (user as any).verified === false) {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        {verifyProcessing ? (
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-sm text-gray-500">Verificando e-mail...</p>
          </div>
        ) : verifyMsg ? (
          <div className="text-center p-8">
            <p className={`text-sm font-medium ${verifyMsg.includes('sucesso') || verifyMsg.includes('já verificado') ? 'text-emerald-600' : 'text-red-600'}`}>
              {verifyMsg}
            </p>
            <p className="text-xs text-gray-400 mt-4">Redirecionando para o login...</p>
          </div>
        ) : (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        )}
      </div>
    );
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


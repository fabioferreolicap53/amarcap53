/// <reference types="vite/client" />
import PocketBase from 'pocketbase';

// Substitua pela URL da sua VM na Oracle Cloud (Use HTTPS se disponível)
const pocketbaseUrl = import.meta.env.VITE_POCKETBASE_URL || 'https://centraldedados.dev.br';
export const pb = new PocketBase(pocketbaseUrl);

// Desativa o auto cancelamento de requisições duplicadas (opcional, mas recomendado para React)
pb.autoCancellation(false);

// Interceptor global de resposta.
// Se a sessão expirou/é inválida (401, ou 400 no auth-refresh), limpa o authStore.
// Sem isso, as telas continuam montadas e exibem listas vazias ("sistema zerado")
// em vez de devolver o usuário para o login.
pb.afterSend = (response, data) => {
  const url = response.url || '';
  const isAuthFailure =
    response.status === 401 ||
    (response.status === 400 && url.indexOf('/auth-refresh') !== -1);

  if (isAuthFailure && pb.authStore.token) {
    console.warn('[pb] Sessão expirada ou inválida. Redirecionando para o login.');
    pb.authStore.clear();
  }

  return data;
};

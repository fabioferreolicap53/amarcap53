/// <reference types="vite/client" />
import PocketBase from 'pocketbase';

// Substitua pela URL da sua VM na Oracle Cloud (Use HTTPS se disponível)
export const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL || 'https://centraldedados.dev.br');

// Desativa o auto cancelamento de requisições duplicadas (opcional, mas recomendado para React)
pb.autoCancellation(false);

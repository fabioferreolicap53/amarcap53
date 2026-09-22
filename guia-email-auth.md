# Guia Completo — Sistema de E-mail e Telas de Autenticação

> **Projeto:** Painel Sorriso 5.3
> **Stack:** React 19 + Vite 8 + TypeScript + Tailwind CSS 4 + PocketBase v0.22+
> **Deploy:** Cloudflare Pages (frontend) + PocketBase hospedado (backend)
> **Última atualização:** 2026-09-21

---

## Sumário

1. [Arquitetura Geral](#1-arquitetura-geral)
2. [Configuração do PocketBase (SMTP + Templates)](#2-configuração-do-pocketbase)
3. [Fluxos de E-mail](#3-fluxos-de-e-mail)
4. [Implementação Frontend — Arquivo por Arquivo](#4-implementação-frontend)
5. [Componentes React (Auth.tsx)](#5-componentes-react)
6. [Script Inline do index.html](#6-script-inline-do-indexhtml)
7. [Service Worker e Cache](#7-service-worker-e-cache)
8. [Variáveis de Ambiente](#8-variáveis-de-ambiente)
9. [Variáveis de Ambiente — Variáveis de Ambiente](#9-pontos-críticos-e-armadilhas)
10. [Checklist de Implementação](#10-checklist-de-implementação)

---

## 1. Arquitetura Geral

```
┌─────────────────────────────────────────────────────────┐
│                    FLUXO COMPLETO                        │
│                                                         │
│  Usuário → React (frontend) → PocketBase (backend)      │
│              │                      │                   │
│              │    REST API          │  SMTP             │
│              │◄────────────────────►│  (envia emails)   │
│              │                      │                   │
│  index.html  │  Antes do React:     │                   │
│  (script     │  - Captura tokens    │                   │
│   inline)    │  - Limpa URL          │                   │
│              │  - POST forms         │                   │
└─────────────────────────────────────────────────────────┘
```

### Componentes do Sistema

| Camada | Arquivo | Responsabilidade |
|--------|---------|------------------|
| **Configuração PocketBase** | Dashboard → Settings → Mail settings | SMTP, templates de email, collection de usuários |
| **Script Inline** | `index.html` | Intercepta `?verify=TOKEN` e `?token=TOKEN` antes do React carregar |
| **Componentes Auth** | `src/Auth.tsx` | Todas as telas: login, registro, verificação, esqueci senha, ações de email |
| **Orquestrador** | `src/PainelSorriso53.tsx` | Detecta parâmetros de URL, escolhe qual tela renderizar |
| **Configurações** | `src/PaginaConfiguracoes.tsx` | Troca de email (logado) |

---

## 2. Configuração do PocketBase

### 2.1 SMTP

No dashboard do PocketBase → **Settings → Mail settings**:

| Campo | Valor (exemplo Gmail) | Observação |
|-------|----------------------|------------|
| **Sender name** | Painel Sorriso 5.3 | Nome que aparece no "De:" |
| **Sender address** | `no-reply@seudominio.com` | Deve ser um endereço válido |
| **SMTP server host** | `smtp.gmail.com` | Para Gmail |
| **Port** | `465` | TLS |
| **Username** | `seuemail@gmail.com` | Email da conta Gmail |
| **Password** | `[Senha de App de 16 caracteres]` | **NÃO é a senha normal** — ver abaixo |
| **TLS encryption** | Always | |
| **AUTH method** | PLAIN (default) | |

#### Erro 534 "Application-specific password required"

O Gmail com autenticação de dois fatores (2FA) ativa **exige Senha de App** para conexões SMTP. Senha normal não funciona.

**Como gerar:**
1. Acesse https://myaccount.google.com/apppasswords
2. Crie um app chamado "PocketBase"
3. Cole a senha gerada (16 caracteres) no campo Password do PocketBase

#### Erro 535 "Username and Password not accepted"

Possíveis causas:
- Username com typo (ex: `.gmail.cc` em vez de `.gmail.com`)
- Senha incorreta ou senha normal do Gmail (precisa ser Senha de App se 2FA ativo)
- Conta com verificação em duas etapas ativada

### 2.2 Collection de Usuários

A collection de autenticação deve ser criada no PocketBase com:
- **Nome:** `<prefixo>_users` (ex: `painelsorriso53_users`)
- **Authentication habilitada:** Sim
- **Campo `verified`:** Habilitado (checkbox "Require email verification")

Campos customizados (opcional):
| Campo | Tipo | Uso |
|-------|------|-----|
| `role` | text | `unidade`, `odonto`, `cap` |
| `unidade` | text | Nome da unidade de saúde |
| `equipe` | text | Equipes vinculadas |
| `name` | text | Nome do usuário |

### 2.3 Templates de Email

No PocketBase → Collection → Settings → **Email templates**:

#### Template de Verificação (Verification)

URL do link:
```
https://seu-dominio.pages.dev/?verify={TOKEN}
```

#### Template de Redefinição de Senha (Password reset)

URL do link:
```
https://seu-dominio.pages.dev/?token={TOKEN}
```

#### Template de Confirmação de Troca de Email (Confirm email change)

URL do link:
```
https://seu-dominio.pages.dev/confirm-email-change?token={TOKEN}
```

> **IMPORTANTE:** O token vai na URL como query parameter. O script inline do `index.html` captura e limpa antes do React carregar.

---

## 3. Fluxos de E-mail

### 3.1 Verificação de Email (Registro)

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│ Usuário  │     │  React   │     │ PocketBase│     │  Gmail   │
│          │     │ (front)  │     │ (server)  │     │ (SMTP)   │
└────┬─────┘     └────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                 │                 │
     │ 1. Preenche    │                 │                 │
     │ formulário     │                 │                 │
     │───────────────►│                 │                 │
     │                │ 2. POST         │                 │
     │                │ records         │                 │
     │                │────────────────►│                 │
     │                │                 │                 │
     │                │ 3. POST         │                 │
     │                │ request-        │                 │
     │                │ verification    │                 │
     │                │────────────────►│ 4. Envio        │
     │                │                 │────────────────►│
     │                │                 │                 │
     │                │ 5. Redirect     │                 │
     │                │ para /verify    │                 │
     │◄───────────────│                 │                 │
     │                │                 │                 │
     │ 6. Clica no    │                 │                 │
     │ link do email  │                 │                 │
     │─────────────────────────────────►│                 │
     │ 7. index.html:  │                 │                 │
     │ ?verify=TOKEN   │                 │                 │
     │ script inline   │                 │                 │
     │ faz POST form-  │                 │                 │
     │ urlencoded      │                 │                 │
     │─────────────────────────────────►│                 │
     │                │ 8. Redirect     │                 │
     │                │ para ?verified=1│                 │
     │◄─────────────────────────────────│                 │
     │                │                 │                 │
     │ 9. TelaVerificacaoResultado     │                 │
     │ "E-mail Confirmado!"            │                 │
     │◄───────────────│                 │                 │
```

**Formato de request — `request-verification`:**
```javascript
fetch(`${PB_URL}/api/collections/${COLLECTION}/request-verification`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
  },
  body: "email=" + encodeURIComponent(email.trim()),
});
// Retorna 204 (sem corpo) em caso de sucesso
```

**Formato de request — `confirm-verification` (via script inline):**
```javascript
fetch(`${pbUrl}/api/collections/${COLLECTION}/confirm-verification`, {
  method: "POST",
  headers: {
    "Content-Type": "application/x-www-form-urlencoded",
    "Accept": "application/json",
  },
  body: "token=" + encodeURIComponent(verifyToken),
});
```

> **CRÍTICO:** `confirm-verification` DEVE usar `application/x-www-form-urlencoded` com campo `token`. Usar JSON (`{token}`) retorna **400 Bad Request**.

### 3.2 Redefinição de Senha (Esqueci a Senha)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Usuário  │     │  React   │     │ PocketBase│
│          │     │          │     │  + SMTP   │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                 │
     │ 1. Clica       │                 │
     │ "Esqueceu a    │                 │
     │  senha?"       │                 │
     │───────────────►│                 │
     │                │ 2. POST         │
     │                │ request-        │
     │                │ password-reset  │
     │                │ { email }       │
     │                │────────────────►│ 3. Email com
     │                │                 │ ?token=TOKEN
     │                │                 │
     │ 4. Clica link  │                 │
     │──────────────────────────────────►│
     │ 5. index.html detecta token,     │
     │ salva em window.__authToken      │
     │ __authAction = 'reset_password'  │
     │                │                 │
     │ 6. React renderiza               │
     │ EmailActionPage                  │
     │ (action=reset_password)          │
     │◄───────────────│                 │
     │                │                 │
     │ 7. Preenche    │                 │
     │ nova senha     │                 │
     │───────────────►│ 8. POST         │
     │                │ confirm-        │
     │                │ password-reset  │
     │                │ {token,pass,    │
     │                │  passConfirm}   │
     │                │────────────────►│
     │ 9. Sucesso     │                 │
     │ "Voltar ao     │                 │
     │  Login"        │                 │
     │◄───────────────│                 │
```

**Formato de request — `request-password-reset`:**
```javascript
fetch(`${PB_URL}/api/collections/${COLLECTION}/request-password-reset`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email: email.trim() }),
});
// Retorna 204
```

**Formato de request — `confirm-password-reset`:**
```javascript
fetch(`${PB_URL}/api/collections/${COLLECTION}/confirm-password-reset`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token,
    password: newPassword,
    passwordConfirm: confirmPassword,
  }),
});
```

### 3.3 Troca de Email (usuário logado)

```
┌──────────┐     ┌──────────┐     ┌──────────┐
│ Usuário  │     │  React   │     │ PocketBase│
│ (logado) │     │          │     │  + SMTP   │
└────┬─────┘     └────┬─────┘     └────┬─────┘
     │                │                 │
     │ 1. Em Config.  │                 │
     │ digita novo    │                 │
     │ email          │                 │
     │───────────────►│ 2. POST         │
     │                │ request-email-  │
     │                │ change          │
     │                │ { newEmail }    │
     │                │ + Authorization │
     │                │────────────────►│ 3. Email com
     │                │                 │ /confirm-email-change?token=TOKEN
     │ 4. Clica link  │                 │
     │──────────────────────────────────►│
     │ 5. index.html detecta             │
     │ /confirm-email-change no path     │
     │ __authAction = 'confirm_email_change'
     │                │                 │
     │ 6. EmailActionPage               │
     │ (action=confirm_email_change)    │
     │ Pede senha atual                 │
     │◄───────────────│                 │
     │                │                 │
     │ 7. Digita      │                 │
     │ senha atual    │                 │
     │───────────────►│ 8. POST         │
     │                │ confirm-email-  │
     │                │ change          │
     │                │ {token,password}│
     │                │────────────────►│
     │ 9. Sucesso     │                 │
     │◄───────────────│                 │
```

**Formato de request — `request-email-change`:**
```javascript
fetch(`${PB_URL}/api/collections/${COLLECTION}/request-email-change`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "Accept": "application/json",
    "Authorization": `Bearer ${token}`, // OBRIGATÓRIO
  },
  body: JSON.stringify({ newEmail: novoEmail.trim() }),
});
```

> **CRÍTICO:** `request-email-change` EXIGE header `Authorization` com token do usuário logado. Sem ele, retorna **403 Forbidden**.

**Formato de request — `confirm-email-change`:**
```javascript
fetch(`${PB_URL}/api/collections/${COLLECTION}/confirm-email-change`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    token,
    password: currentPassword, // senha atual do usuário
  }),
});
```

---

## 4. Implementação Frontend — Arquivo por Arquivo

### 4.1 `index.html` — Script Inline (ANTES do React)

O script inline é **essencial** para o fluxo de verificação. Ele executa antes do React carregar e:

1. Captura `?verify=TOKEN` e `?token=TOKEN` da URL
2. Limpa a URL via `history.replaceState` (tokens ficam invisíveis na barra de endereço)
3. Para `?verify=TOKEN`: faz POST direto para `confirm-verification` (form-urlencoded)
4. Para `?token=TOKEN`: salva em `window.__authToken` e detecta a ação pelo pathname

```html
<script>
(function () {
  var params = new URLSearchParams(window.location.search);
  var verifyToken = params.get('verify');
  var authToken = params.get('token');
  var pbUrl = (window.__POCKETBASE_URL || 'https://SEU-DOMINIO.com').replace(/\/+$/, '');

  // Limpa a URL (tokens ficam invisíveis)
  if (verifyToken || authToken) {
    window.history.replaceState(null, '', window.location.pathname);
  }

  // Detecta ação de token (reset de senha ou troca de email)
  if (authToken) {
    var actionPath = window.location.pathname.toLowerCase();
    window.__authAction = actionPath.indexOf('/confirm-email-change') !== -1
      ? 'confirm_email_change' : 'reset_password';
    window.__authToken = authToken;
  }

  // Processa verificação de email
  if (verifyToken) {
    if (window.fetch) {
      fetch(pbUrl + '/api/collections/SUA_COLLECTION_USERS/confirm-verification', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: 'token=' + encodeURIComponent(verifyToken),
      }).then(function(resp) {
        var ct = resp.headers.get('content-type') || '';
        if (ct.indexOf('application/json') !== -1) {
          return resp.json().then(function(data) {
            if (resp.ok) {
              window.location.href = window.location.pathname + '?verified=1';
            } else {
              var msg = (data && data.message) || '';
              if (msg.indexOf('already') !== -1 || msg.indexOf('verificado') !== -1) {
                window.location.href = window.location.pathname + '?verified=1';
              } else {
                window.location.href = window.location.pathname + '?verify_error=' + encodeURIComponent(msg || 'token_invalido');
              }
            }
          });
        }
        if (resp.ok || resp.redirected) {
          window.location.href = window.location.pathname + '?verified=1';
        } else {
          window.location.href = window.location.pathname + '?verify_error=http_' + resp.status;
        }
      }).catch(function() {
        window.location.href = window.location.pathname + '?verify_error=connection';
      });
    } else {
      // Fallback: form HTML
      var form = document.createElement('form');
      form.method = 'POST';
      form.action = pbUrl + '/api/collections/SUA_COLLECTION_USERS/confirm-verification';
      form.target = '_self';
      form.style.display = 'none';
      var input = document.createElement('input');
      input.type = 'hidden';
      input.name = 'token';
      input.value = verifyToken;
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }
})();
</script>
```

#### Onde colocar no `index.html`

Antes do `</body>`, **depois** da tag `<div id="root"></div>` e **antes** da tag do Service Worker:

```html
<body>
  <div id="root"></div>

  <!-- 1. Script inline de autenticação -->
  <script>
  (function () { /* ... código acima ... */ })();
  </script>

  <!-- 2. Service Worker -->
  <script>
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(function() {});
    }
  </script>
</body>
```

### 4.2 `src/PainelSorriso53.tsx` — Orquestrador de Rotas

Este arquivo detecta parâmetros de URL e decide qual tela renderizar.

```tsx
// 1. Lê window.__authToken (definido pelo script inline)
const [emailAction] = useState<{ token: string; action: EmailAction } | null>(() => {
  const token = (window as Record<string, unknown>).__authToken as string | undefined;
  const action = (window as Record<string, unknown>).__authAction as EmailAction | undefined;
  delete (window as Record<string, unknown>).__authToken;
  delete (window as Record<string, unknown>).__authAction;
  if (token && token.length >= 10 && action) {
    return { token, action };
  }
  return null;
});

// 2. Detecta resultado da verificação de email
const [verificacaoStatus, setVerificacaoStatus] = useState<"nenhum" | "sucesso" | "erro">(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("verified") === "1") {
    window.history.replaceState(null, "", window.location.pathname);
    return "sucesso";
  }
  if (params.get("verify_error")) {
    window.history.replaceState(null, "", window.location.pathname);
    return "erro";
  }
  return "nenhum";
});

// 3. View atual de auth
const [authView, setAuthView] = useState<AuthView>("login");

// 4. Navegação entre telas
function handleAuthNavigate(view: string) {
  setAuthView(view as AuthView);
  setVerificacaoStatus("nenhum"); // ← IMPORTANTE: reseta o status
  window.scrollTo(0, 0);
}

// 5. Árvore de renderização (quando não autenticado)
if (!user) {
  if (emailAction) return <EmailActionPage token={...} action={...} onNavigate={...} />;
  if (verificacaoStatus === "sucesso") return <TelaVerificacaoResultado tipo="sucesso" onNavigate={...} />;
  if (verificacaoStatus === "erro") return <TelaVerificacaoResultado tipo="erro" onNavigate={...} />;
  switch (authView) {
    case "register": return <TelaRegister onNavigate={...} />;
    case "verify": return <TelaVerify onNavigate={...} />;
    case "forgot": return <TelaForgot onNavigate={...} />;
    default: return <TelaLogin onLogin={...} onNavigate={...} />;
  }
}
```

> **BUG COMUM:** Se `setVerificacaoStatus` não for chamado em `handleAuthNavigate`, o `verificacaoStatus` fica preso em `"sucesso"` e o botão "Voltar ao Login" nunca funciona.

---

## 5. Componentes React

### 5.1 `InputField` — Componente com Toggle de Senha

```tsx
function InputField({ label, icon, type, ...props }: {
  label: string;
  icon: React.ReactNode;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  const isPassword = type === "password";
  const [revealed, setRevealed] = useState(false);

  return (
    <div>
      <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 ml-1">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">{icon}</span>
        <input
          {...props}
          type={isPassword && revealed ? "text" : type}
          className={`w-full rounded-2xl border-2 border-slate-100 bg-slate-50 py-3.5 pl-12 ${isPassword ? "pr-12" : "pr-4"} text-sm font-medium text-slate-900 placeholder-slate-300 outline-none transition-all focus:border-blue-400/50 focus:bg-white focus:ring-4 focus:ring-blue-500/5`}
        />
        {isPassword && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setRevealed((v) => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 transition-colors hover:text-slate-500"
          >
            {/* Ícone de olho (visível) ou olho riscado (oculto) */}
            {revealed
              ? <svg>/* olho aberto */</svg>
              : <svg>/* olho riscado */</svg>
            }
          </button>
        )}
      </div>
    </div>
  );
}
```

**Como usar:**
```tsx
// Campo normal (sem toggle)
<InputField label="Email" type="email" icon={iconMail} />

// Campo de senha (toggle aparece automaticamente)
<InputField label="Senha" type="password" icon={iconLock} />
```

> O toggle de visibilidade é automático: sempre que `type="password"`, o botão de olho aparece.

### 5.2 Resumo dos Componentes

| Componente | Props | Descrição |
|------------|-------|-----------|
| `AuthCard` | `children` | Card centralizado com sombra e gradiente |
| `Logo` | — | Ícone + nome do app |
| `InputField` | `label`, `icon`, `...inputProps` | Campo de entrada com ícone e toggle de senha |
| `ErrorMsg` | `msg` | Mensagem de erro estilizada |
| `SuccessMsg` | `msg` | Mensagem de sucesso estilizada |
| `TelaLogin` | `onLogin`, `onNavigate` | Tela de login com campos email/senha |
| `TelaRegister` | `onNavigate` | Tela de registro com seleção de perfil |
| `TelaVerify` | `onNavigate` | Tela de reenvio de email de confirmação |
| `TelaForgot` | `onNavigate` | Tela de esqueci a senha (com cooldown 30s) |
| `EmailActionPage` | `token`, `action`, `onNavigate` | Página unificada para reset de senha e troca de email |
| `TelaVerificacaoResultado` | `tipo`, `onNavigate` | Tela de resultado (sucesso/erro) da verificação |

### 5.3 Tipos Exportados

```tsx
type EmailAction = "reset_password" | "confirm_email_change";
type AuthView = "login" | "register" | "verify" | "forgot" | "confirm-email" | "verified" | "verify_error";
```

---

## 6. Formatos de Request — Tabela de Referência

| Endpoint | Method | Content-Type | Body | Auth | Retorno |
|----------|--------|--------------|------|------|---------|
| `auth-with-password` | POST | `application/json` | `{ identity, password }` | Não | 200 + `{ token, record }` |
| `request-verification` | POST | `application/x-www-form-urlencoded` | `email=...` | Não | 204 |
| `confirm-verification` | POST | `application/x-www-form-urlencoded` | `token=...` | Não | 200 |
| `request-password-reset` | POST | `application/json` | `{ email }` | Não | 204 |
| `confirm-password-reset` | POST | `application/json` | `{ token, password, passwordConfirm }` | Não | 204 |
| `request-email-change` | POST | `application/json` | `{ newEmail }` | **Sim (Bearer)** | 204 |
| `confirm-email-change` | POST | `application/json` | `{ token, password }` | Não | 204 |

### Armadilhas de Content-Type

- `request-verification` e `confirm-verification` → **DEVEM** usar `application/x-www-form-urlencoded`. Usar JSON retorna **400 Bad Request**.
- Todos os outros endpoints de email → usam `application/json`.

### Bloqueio de Login Não Verificado

Após `auth-with-password`, verificar:
```tsx
if (data.record.verified === false || data.record.verified === 0) {
  // Bloquear acesso, mostrar mensagem "Email não confirmado"
}
```

---

## 7. Service Worker e Cache

### Estratégia de Cache

```javascript
// sw.js
const CACHE_NAME = "nome-do-app-v1";

// Navegação (HTML): network-first com fallback cache
if (e.request.mode === "navigate") {
  // Tenta rede primeiro, se falhar usa cache
}

// Assets (JS, CSS, SVG, PNG, WOFF2): stale-while-revalidate
// Retorna cache imediatamente, busca versão nova em background
```

### Importante para Deploy

- O service worker **não bloqueia** novos bundles (o Vite gera hashes diferentes para cada build, causando cache-miss)
- Após deploy, o usuário pode ver assets antigos do cache se o service worker não for atualizado
- Recomendação: incrementar `CACHE_NAME` a cada deploy significativo

---

## 8. Variáveis de Ambiente

### `.env` (nunca committar)

```bash
# URL do servidor PocketBase
VITE_POCKETBASE_URL=https://seudominio.com

# Nome da collection principal (pacientes/dados)
VITE_POCKETBASE_COLLECTION=app_pacientes

# Token estático (opcional, para scripts)
VITE_POCKETBASE_TOKEN=

# Credenciais do superuser PocketBase (para scripts)
PB_EMAIL=seu@email.com
PB_PASSWORD=sua_senha
```

### `.env.example`

```bash
VITE_POCKETBASE_URL=
VITE_POCKETBASE_COLLECTION=
```

### No Código

```tsx
const PB_URL = import.meta.env.VITE_POCKETBASE_URL as string;
const PB_COLLECTION = import.meta.env.VITE_POCKETBASE_COLLECTION as string;
```

### Token no localStorage

Chave: `pb_auth_token`

| Operação | Quando |
|----------|--------|
| `localStorage.setItem("pb_auth_token", token)` | Login bem-sucedido |
| `localStorage.getItem("pb_auth_token")` | Todas as requisições autenticadas |
| `localStorage.removeItem("pb_auth_token")` | Logout ou exclusão de conta |

---

## 9. Pontos Críticos e Armadilhas

### 9.1 Erros Comuns de Implementação

| Erro | Causa | Solução |
|------|-------|---------|
| `confirm-verification` retorna 400 | Body usando JSON em vez de form-urlencoded | Usar `Content-Type: application/x-www-form-urlencoded` + `token=` |
| E-mail de verificação não chega | `request-verification` nunca foi chamado | Chamar após registro |
| Botão "Voltar ao Login" não funciona | `verificacaoStatus` não é resetado | Chamar `setVerificacaoStatus("nenhum")` em `handleAuthNavigate` |
| Login bloqueia usuário verificado | Verificação de `verified` incorreta | Checar `=== false` E `=== 0` (PocketBase usa ambos) |
| Troca de email retorna 403 | Header Authorization ausente | Enviar `Authorization: Bearer ${token}` |
| Deploy não atualiza produção | Build com erros de TypeScript | Verificar `npm run build` antes de push |
| Erro SMTP 534 | Senha normal do Gmail com 2FA ativo | Gerar Senha de App em myaccount.google.com/apppasswords |
| Erro SMTP 535 | Username ou senha incorretos | Verificar email completo (`.com` não `.cc`) e senha de app |
| Email de teste funciona mas app não | Bundle antigo em produção | Fazer rebuild + deploy |

### 9.2 Tokens na URL

- Tokens ficam na URL como query parameters (`?verify=TOKEN`, `?token=TOKEN`)
- O script inline limpa a URL imediatamente via `history.replaceState`
- **Nunca** exibir tokens na interface do usuário
- **Nunca** logar tokens em console.error em produção

### 9.3 Segurança

- Usar mensagem genérica "Se o e-mail estiver cadastrado, você receberá um link" para prevenir enumeração de usuários
- Não revelar se o email existe ou não em respostas de `request-password-reset`
- Adicionar cooldown (30s) entre envios de `request-password-reset`
- Bloquear login para usuários não verificados
- Troca de email exige senha atual

### 9.4 Dois Apps no Mesmo PocketBase

Se o mesmo PocketBase serve múltiplos apps (ex: appA_users, appB_users):
- Cada app usa sua própria collection de users
- O `request-verification` usa a collection do endpoint chamado
- Os templates de email são por collection
- Cuidado para não misturar collections no código

---

## 10. Checklist de Implementação

### Passo 1: PocketBase

- [ ] Collection de users criada com auth habilitada
- [ ] Campo "Require email verification" marcado
- [ ] SMTP configurado (host, porta, username, **senha de app**)
- [ ] Template de verificação: `?verify={TOKEN}`
- [ ] Template de reset: `?token={TOKEN}`
- [ ] Template de troca de email: `/confirm-email-change?token={TOKEN}`
- [ ] Testar envio de email no dashboard (Send test email → Verification)

### Passo 2: index.html

- [ ] Script inline adicionado antes de `</body>`
- [ ] URL do PocketBase configurada (`window.__POCKETBASE_URL`)
- [ ] Nome da collection de users ajustado no fetch de `confirm-verification`
- [ ] Script do Service Worker adicionado

### Passo 3: Frontend

- [ ] Componente `InputField` com toggle de senha
- [ ] `TelaLogin` — campos email + senha + verificação de `verified`
- [ ] `TelaRegister` — registro + `request-verification` (form-urlencoded)
- [ ] `TelaVerify` — reenvio de email de confirmação
- [ ] `TelaForgot` — `request-password-reset` + cooldown 30s
- [ ] `EmailActionPage` — `confirm-password-reset` e `confirm-email-change`
- [ ] `TelaVerificacaoResultado` — tela de sucesso/erro
- [ ] Orquestrador — detecção de `__authToken`, `__authAction`, `verified=1`
- [ ] `handleAuthNavigate` — reseta `verificacaoStatus`

### Passo 4: Configurações (logado)

- [ ] `PaginaConfiguracoes` — `request-email-change` com header `Authorization`

### Passo 5: Deploy

- [ ] `npm run build` passa sem erros
- [ ] `dist/index.html` contém script inline
- [ ] Push para GitHub ou deploy manual
- [ ] Verificar em produção: bundle novo carregado (DevTools → Sources)
- [ ] Teste completo: registro → email → verificação → login

### Passo 6: Validação

- [ ] Registro envia email de confirmação
- [ ] Link no email funciona (verificação OK)
- [ ] Botão "Voltar ao Login" funciona após verificação
- [ ] Login bloqueia usuário não verificado
- [ ] "Esqueci a senha" envia email com link funcional
- [ ] Reset de senha funciona (nova senha definida)
- [ ] Troca de email envia confirmação
- [ ] Confirmação de troca de email funciona
- [ ] Toggle de visibilidade de senha funciona em todas as telas
- [ ] Mensagens de erro são genéricas (sem enumeração de usuários)

---

## Referência Rápida de Endpoints

```
POST /api/collections/{collection}/auth-with-password        → Login
POST /api/collections/{collection}/request-verification      → Enviar email de verificação (form-urlencoded)
POST /api/collections/{collection}/confirm-verification      → Confirmar verificação (form-urlencoded)
POST /api/collections/{collection}/request-password-reset    → Enviar email de reset (JSON)
POST /api/collections/{collection}/confirm-password-reset    → Confirmar reset de senha (JSON)
POST /api/collections/{collection}/request-email-change      → Solicitar troca de email (JSON + Authorization)
POST /api/collections/{collection}/confirm-email-change      → Confirmar troca de email (JSON)
```

---

*Guia gerado automaticamente a partir da implementação do Painel Sorriso 5.3.*

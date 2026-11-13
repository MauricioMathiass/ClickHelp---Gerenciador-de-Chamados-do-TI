# ClickHELP — Gerenciador de Chamados de TI

Sistema web para abertura e acompanhamento de chamados de TI, com painel de atendimento, controle de SLA em horas úteis, relatórios em Excel e notificações.

Pode ser usado por **qualquer empresa**: nome, logo, cores, locais, categorias, expediente, prazos de SLA e feriados são definidos pelo administrador na tela **Configurações**, sem mexer no código.

- **Frontend:** React 19 + Vite (`frontend/`)
- **Backend:** Node.js + Express 5 (`backend/`)
- **Banco de dados:** PostgreSQL (Neon em produção; banco embutido para desenvolvimento e testes)

## Arquitetura

```
Navegador → Netlify (frontend) → Render (API Express) → Neon (PostgreSQL)
```

| Ambiente            | Frontend               | Backend               | Banco                                   |
| ------------------- | ---------------------- | --------------------- | --------------------------------------- |
| Máquina / Codespace | `npm run dev:frontend` | `npm run dev:backend` | branch `dev` do Neon, ou banco embutido |
| Produção            | Netlify                | Render                | branch principal (`production`) do Neon |

## Como rodar

Pré-requisito: Node.js 20 ou mais recente.

```bash
# 1. Instalar dependências (backend e frontend)
npm run install:all

# 2. Configurar variáveis de ambiente
cp backend/.env.example backend/.env     # defina ADMIN_PASSWORD, JWT_SECRET e DATABASE_URL
cp frontend/.env.example frontend/.env

# 3. Subir backend (porta 3001) e frontend (porta 5173), em terminais separados
npm run dev:backend
npm run dev:frontend
```

Acesse `http://localhost:5173`, entre com o administrador do `.env` e abra **Configurações** para ajustar o sistema à sua empresa.

**Banco de dados:** com `DATABASE_URL` no `backend/.env`, o backend usa esse PostgreSQL (para desenvolver, use a branch `dev` do Neon). Sem essa linha, ele usa um **banco embutido** gravado em `backend/src/data/pgdata`, para rodar o projeto sem configurar nada. As tabelas são criadas automaticamente quando o backend inicia.

O navegador fala só com o frontend: as chamadas para `/api` são repassadas pelo Vite ao backend (`frontend/vite.config.js`). Por isso o mesmo passo a passo funciona na sua máquina, em outro computador da rede e no GitHub Codespaces.

### GitHub Codespaces

O repositório tem um `.devcontainer`: ao criar o Codespace, as dependências são instaladas e os `.env` são criados a partir dos exemplos.

1. (Opcional) Em **GitHub → Settings → Codespaces → Secrets**, cadastre `DATABASE_URL` (branch `dev` do Neon), `JWT_SECRET`, `ADMIN_USERNAME` e `ADMIN_PASSWORD` e libere para este repositório. Eles têm prioridade sobre o `.env`. Sem `DATABASE_URL`, o Codespace usa o banco embutido.
2. No terminal do Codespace, rode `npm run dev:backend` e, em outro terminal, `npm run dev:frontend`.
3. A porta **5173** abre no navegador. Não é preciso abrir a 3001.

## Publicação (Netlify + Render + Neon)

Tudo parte do GitHub: cada push na `main` passa pelo CI (GitHub Actions), e o Render e o Netlify publicam a nova versão sozinhos.

```
GitHub (main) → CI (lint, testes, build) → Render (API) + Netlify (site) → Neon (banco)
```

### 1. Neon (banco de dados)

1. Em [console.neon.tech](https://console.neon.tech), crie um projeto na região **AWS US East 1 (N. Virginia)**, a mesma da API no Render.
2. Na branch principal (`production`), clique em **Connect**, ligue **Connection pooling** e copie a connection string (o servidor tem `-pooler` no nome). Ela será o `DATABASE_URL` do Render.
3. (Opcional) Crie uma branch `dev` e use a connection string dela no `backend/.env` ou nos secrets do Codespaces, para desenvolver sem mexer nos dados reais.

As tabelas são criadas automaticamente quando a API inicia.

### 2. Render (API)

1. Em [dashboard.render.com](https://dashboard.render.com), **New → Blueprint** e escolha este repositório. O `render.yaml` cria o serviço `clickhelp-api`.
2. Preencha as variáveis pedidas:

| Variável          | Valor                                                              |
| ----------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`    | connection string do Neon (passo 1)                                |
| `ADMIN_USERNAME`  | login do administrador inicial                                     |
| `ADMIN_PASSWORD`  | senha do administrador inicial                                     |
| `FRONTEND_ORIGIN` | endereço do site no Netlify (ex.: `https://clickhelp.netlify.app`) |
| `JWT_SECRET`      | gerado pelo Render, não precisa preencher                          |

3. Depois do deploy, abra `https://<sua-api>.onrender.com/api/health`: deve responder `"status": "ok"`.

O Render publica a cada push na `main`, só depois de o CI passar (`autoDeployTrigger: checksPass`). No plano gratuito, a API "dorme" após 15 minutos sem uso e o primeiro acesso depois disso leva até cerca de 1 minuto.

### 3. Netlify (site)

1. Em [app.netlify.com](https://app.netlify.com), **Add new project → Import an existing project → GitHub** e escolha este repositório. O `netlify.toml` já define pasta, build e publicação.
2. Em **Site configuration → Environment variables**, cadastre `VITE_API_URL` com o endereço da API terminando em `/api` (ex.: `https://clickhelp-api.onrender.com/api`). Sem ela, o build no Netlify falha de propósito, com uma mensagem explicando o que falta.
3. (Opcional) Cadastre também as variáveis `VITE_EMAILJS_*` e `VITE_NOTIFICATION_EMAIL_TO` para o aviso por e-mail de novos chamados.
4. Faça um novo deploy (**Deploys → Trigger deploy**), pois as variáveis `VITE_*` entram no momento do build.

### 4. Conferência final

- No Render, `FRONTEND_ORIGIN` precisa ser o endereço exato do site no Netlify (vários endereços podem ser separados por vírgula). Se o login mostrar "Não foi possível conectar ao servidor", é quase sempre isso ou o `VITE_API_URL`.
- Entre no site com o administrador do Render e ajuste a empresa em **Configurações**.

### Importar dados da versão com arquivos JSON

Versões anteriores guardavam os dados em `backend/src/data/*.json`. Para levá-los ao banco, aponte `DATABASE_URL` para o banco de destino e rode:

```bash
npm --prefix backend run db:import
```

O script pode rodar mais de uma vez: só insere o que ainda não existe no banco.

## Comandos

| Comando                                        | O que faz                                      |
| ---------------------------------------------- | ---------------------------------------------- |
| `npm run dev:backend` / `npm run dev:frontend` | Ambiente de desenvolvimento                    |
| `npm test`                                     | Testes automatizados do backend                |
| `npm run lint` / `npm run lint:fix`            | Verifica / corrige o padrão de código (ESLint) |
| `npm run format`                               | Formata o código (Prettier)                    |
| `npm run build:frontend`                       | Gera a versão de produção do frontend          |
| `npm --prefix backend run db:import`           | Importa os dados dos arquivos JSON antigos     |

Os testes usam um PostgreSQL embutido só na memória e nunca mexem no Neon nem nos dados reais.

## Perfis de acesso

| Perfil             | O que pode fazer                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Usuário**        | Abrir chamados e acompanhar os próprios chamados                                                  |
| **Analista de TI** | Tudo do usuário + Painel TI (ver todos os chamados, mudar status, responder e fechar) e Histórico |
| **Administrador**  | Tudo do analista + Usuários, Configurações e relatório de SLA                                     |

O primeiro administrador é definido no `backend/.env`. Os demais usuários são gerenciados na tela **Usuários**: cadastrar, mudar perfil e departamento, desativar/reativar e redefinir a senha (é assim que se atende o "Esqueceu a senha?"). Desativar ou redefinir a senha encerra as sessões abertas do usuário.

## Configurações da empresa

| Aba                  | O que define                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------------- |
| **Empresa**          | Nome do sistema, nome da empresa, logo e cores (aplicadas em toda a interface, inclusive no login) |
| **Cadastros**        | Locais/unidades, categorias de chamado e departamentos                                             |
| **SLA e expediente** | Horário de trabalho, dias úteis e prazo (em horas úteis) por prioridade                            |
| **Feriados**         | Feriados nacionais, Carnaval, Corpus Christi e datas próprias da empresa/cidade                    |

As configurações ficam na tabela `settings` do banco. Uma instalação nova começa com valores genéricos.

## Estrutura do projeto

```
backend/
  src/
    config/env.js            leitura do .env
    modules/                 uma pasta por funcionalidade (rotas, controller, service)
      auth/  users/  tickets/  notifications/  settings/
    shared/
      db/                    conexão com o PostgreSQL e criação das tabelas
      http/                  erros HTTP
      roles.js  security.js  perfis, hash de senha e tokens
    app.js  routes.js  server.js
  scripts/import-json.js     importação dos dados das versões com JSON
  test/                      testes automatizados (node --test)

frontend/
  src/
    app/App.jsx              composição da aplicação
    features/                uma pasta por funcionalidade (telas, serviços e estilos)
      auth/  home/  tickets/  sla/  users/  notifications/  settings/
    shared/
      components/            Modal, Select, DatePicker, Feedback, BrandName
      services/api.js        cliente HTTP com o token de login
      styles/                tokens.css (tema), base.css, ui.css (botões, campos, avisos)
      utils/format.js        formatação de datas e textos

netlify.toml                 publicação do frontend
render.yaml                  publicação do backend
.github/workflows/ci.yml     CI: lint, testes e build a cada push
.devcontainer/               ambiente do GitHub Codespaces
```

## Banco de dados

| Tabela                | Conteúdo                                                           |
| --------------------- | ------------------------------------------------------------------ |
| `users`               | Usuários (senha com hash `scrypt`)                                 |
| `chamados`            | Chamados, com status, resposta, prazo de SLA e dados de fechamento |
| `notifications`       | Notificações e seus destinatários (usuários e/ou perfis)           |
| `notification_status` | Leitura e arquivamento de cada notificação, por usuário            |
| `settings`            | Configurações da empresa (um único registro em JSONB)              |

Alterações de chamado rodam em transação com `SELECT ... FOR UPDATE`, então duas pessoas mexendo no mesmo chamado ao mesmo tempo não sobrescrevem uma à outra. Guardam-se as 500 notificações mais recentes.

## Regras importantes

- **Autenticação:** o login gera um token (JWT) assinado com `JWT_SECRET`, válido por 12 horas (ou 7 dias com "Manter conectado"). O perfil e o usuário vêm do token e são conferidos a cada requisição.
- **Senhas:** guardadas com hash `scrypt` na tabela `users`.
- **SLA:** contado em horas úteis, conforme expediente, dias úteis e feriados configurados. O fuso é definido por `TZ` no `.env` (padrão `America/Sao_Paulo`).
- **Fechamento:** só a equipe de TI altera chamados, e fechar exige uma resposta. Data de fechamento, responsável e SLA violado são calculados pelo servidor.
- **Notificações:** ficam no backend e são atualizadas a cada 20 segundos.

## API

| Método         | Rota                       | Acesso                                                     |
| -------------- | -------------------------- | ---------------------------------------------------------- |
| `POST`         | `/api/auth/login`          | público                                                    |
| `GET`          | `/api/auth/me`             | logado                                                     |
| `GET`          | `/api/settings/public`     | público (nome, logo e cores)                               |
| `GET`          | `/api/settings`            | logado                                                     |
| `PUT`          | `/api/settings`            | administrador                                              |
| `GET` / `POST` | `/api/users`               | administrador                                              |
| `PATCH`        | `/api/users/:id`           | administrador (`role`, `active`, `password`, `department`) |
| `GET` / `POST` | `/api/chamados`            | logado (cada perfil vê o que pode)                         |
| `PATCH`        | `/api/chamados/:id`        | TI (só `status` e `resposta`)                              |
| `GET`          | `/api/notifications`       | logado                                                     |
| `POST`         | `/api/notifications/read`  | logado (`ids` ou `all: true`)                              |
| `POST`         | `/api/notifications/clear` | logado                                                     |
| `GET`          | `/api/health`              | público                                                    |

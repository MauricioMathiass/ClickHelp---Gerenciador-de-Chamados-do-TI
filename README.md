# ClickHELP — Gerenciador de Chamados de TI

Sistema web para abertura e acompanhamento de chamados de TI, com painel de atendimento, controle de SLA em horas úteis, relatórios em Excel, notificações e rotinas recorrentes.

Pode ser usado por **qualquer empresa**: nome, logo, cores, locais, categorias, expediente, prazos de SLA, feriados e rotinas são definidos pelo administrador na tela **Configurações**, sem mexer no código.

- **Frontend:** React 19 + Vite (`frontend/`)
- **Backend:** Node.js + Express 5 (`backend/`), com dados em arquivos JSON

## Como rodar

Pré-requisito: Node.js 20 ou mais recente.

```bash
# 1. Instalar dependências (raiz, backend e frontend)
npm run install:all

# 2. Configurar variáveis de ambiente
cp backend/.env.example backend/.env     # defina ADMIN_PASSWORD e JWT_SECRET
cp frontend/.env.example frontend/.env

# 3. Subir backend (porta 3001) e frontend (porta 5173), em terminais separados
npm run dev:backend
npm run dev:frontend
```

Acesse `http://localhost:5173`, entre com o administrador do `.env` e abra **Configurações** para ajustar o sistema à sua empresa.

## Comandos

| Comando                                        | O que faz                                      |
| ---------------------------------------------- | ---------------------------------------------- |
| `npm run dev:backend` / `npm run dev:frontend` | Ambiente de desenvolvimento                    |
| `npm test`                                     | Testes automatizados do backend                |
| `npm run lint` / `npm run lint:fix`            | Verifica / corrige o padrão de código (ESLint) |
| `npm run format`                               | Formata o código (Prettier)                    |
| `npm run build:frontend`                       | Gera a versão de produção do frontend          |

Os testes rodam em uma pasta temporária e não mexem nos dados reais. No `npm run dev:backend`, o `nodemon` ignora a pasta de dados, então abrir chamados não reinicia o servidor.

## Perfis de acesso

| Perfil             | O que pode fazer                                                                                  |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| **Usuário**        | Abrir chamados e acompanhar os próprios chamados                                                  |
| **Analista de TI** | Tudo do usuário + Painel TI (ver todos os chamados, mudar status, responder e fechar) e Histórico |
| **Administrador**  | Tudo do analista + Usuários, Configurações e relatório de SLA                                     |

O primeiro administrador é definido no `backend/.env`. Os demais usuários são gerenciados na tela **Usuários**: cadastrar, mudar perfil e departamento, desativar/reativar e redefinir a senha (é assim que se atende o "Esqueceu a senha?"). Desativar ou redefinir a senha encerra as sessões abertas do usuário.

## Configurações da empresa

| Aba                  | O que define                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Empresa**          | Nome do sistema, nome da empresa, logo e cores (aplicadas em toda a interface, inclusive no login)         |
| **Cadastros**        | Locais/unidades, categorias de chamado e departamentos                                                     |
| **SLA e expediente** | Horário de trabalho, dias úteis e prazo (em horas úteis) por prioridade                                    |
| **Feriados**         | Feriados nacionais, Carnaval, Corpus Christi e datas próprias da empresa/cidade                            |
| **Rotinas**          | Chamados recorrentes da TI (todo dia útil, semanal ou mensal), abertos automaticamente no horário definido |

As configurações ficam em `backend/src/data/settings.json`. Uma instalação nova começa com valores genéricos.

## Estrutura do projeto

```
backend/
  src/
    config/env.js            leitura do .env
    modules/                 uma pasta por funcionalidade (rotas, controller, service)
      auth/  users/  tickets/  notifications/  settings/
    shared/                  erros HTTP, armazenamento JSON, segurança, perfis
    app.js  routes.js  server.js
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
```

## Regras importantes

- **Autenticação:** o login gera um token (JWT) assinado com `JWT_SECRET`, válido por 12 horas (ou 7 dias com "Manter conectado"). O perfil e o usuário vêm do token e são conferidos a cada requisição.
- **Senhas:** guardadas com hash `scrypt` em `backend/src/data/usersStore.json`.
- **SLA:** contado em horas úteis, conforme expediente, dias úteis e feriados configurados. O fuso é definido por `TZ` no `.env` (padrão `America/Sao_Paulo`).
- **Fechamento:** só a equipe de TI altera chamados, e fechar exige uma resposta. Data de fechamento, responsável e SLA violado são calculados pelo servidor.
- **Rotinas:** o servidor verifica a cada 5 minutos. Ao abrir uma nova ocorrência, a anterior que ficou aberta é encerrada automaticamente. Rotinas não entram no relatório de SLA.
- **Notificações:** ficam no backend e são atualizadas a cada 20 segundos.

## Dados

Os arquivos em `backend/src/data/*.json` são a base de dados e **não vão para o Git**. Faça backup dessa pasta. A gravação é atômica e passa por uma fila, então acessos simultâneos não corrompem nem apagam os dados.

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

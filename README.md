# ClickHELP — Gerenciador de Chamados de TI

Sistema web para abertura e acompanhamento de chamados de TI, com painel de atendimento, controle de SLA (48 horas úteis), relatórios em Excel e notificações.

- **Frontend:** React 19 + Vite (`Frontend/`)
- **Backend:** Node.js + Express 5 (`Backend/`), com dados em arquivos JSON

## Perfis de acesso

| Perfil | O que pode fazer |
| --- | --- |
| **Usuário** | Abrir chamados e acompanhar os próprios chamados |
| **Analista de TI** | Tudo do usuário + Painel TI (ver todos os chamados, mudar status, responder e fechar) |
| **Administrador** | Tudo do analista + cadastrar usuários, relatório de SLA, histórico e rotinas diárias fixas |

O primeiro administrador é definido no `Backend/.env`. Os outros usuários são cadastrados por ele na tela **Novo usuário**.

## Como rodar

Pré-requisito: Node.js 20 ou mais recente.

```bash
# 1. Instalar dependências
npm --prefix Backend install
npm --prefix Frontend install

# 2. Configurar variáveis de ambiente
cp Backend/.env.example Backend/.env     # edite ADMIN_PASSWORD e JWT_SECRET
cp Frontend/.env.example Frontend/.env

# 3. Subir backend (porta 3001) e frontend (porta 5173), em terminais separados
npm run dev:backend
npm run dev:frontend
```

Acesse `http://localhost:5173` e entre com o administrador do `.env`.

## Testes

```bash
npm run test:backend
```

Os testes rodam em uma pasta temporária e não mexem nos dados reais.

## Regras importantes

- **Autenticação:** o login gera um token (JWT) assinado com `JWT_SECRET`, válido por 12 horas (ou 7 dias com "Manter conectado"). Todas as rotas de chamados e notificações exigem esse token. O perfil e o usuário vêm do token, nunca da URL ou do corpo da requisição.
- **Senhas:** guardadas com hash `scrypt` em `Backend/src/data/usersStore.json`.
- **SLA:** 48 horas úteis, de segunda a sexta, das 8h às 18h, sem contar feriados nacionais (incluindo a Sexta-feira Santa). O fuso é definido por `TZ` (padrão `America/Sao_Paulo`).
- **Fechamento:** só a equipe de TI altera chamados, e fechar exige uma resposta. Data de fechamento, responsável e SLA violado são calculados pelo servidor.
- **Rotinas fixas:** em cada dia útil, a partir das 7h30, o sistema cria 4 chamados de rotina visíveis só para administradores.
- **Notificações:** ficam no backend (`notificationsStore.json`) e são atualizadas a cada 20 segundos, então chegam à equipe de TI em qualquer computador.

## Dados

Os arquivos em `Backend/src/data/*.json` são a base de dados e **não vão para o Git**. Faça backup dessa pasta. A gravação é atômica e passa por uma fila, então acessos simultâneos não corrompem nem apagam os dados.

## API

| Método | Rota | Acesso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | público |
| `GET` | `/api/auth/me` | logado |
| `POST` | `/api/auth/register` | administrador |
| `GET` | `/api/chamados` | logado (cada perfil vê o que pode) |
| `POST` | `/api/chamados` | logado |
| `PATCH` | `/api/chamados/:id` | TI (só `status` e `resposta`) |
| `GET` | `/api/notifications` | logado |
| `POST` | `/api/notifications/read` | logado |
| `POST` | `/api/notifications/clear` | logado |
| `GET` | `/api/health` | público |

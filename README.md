# ClickHELP — Gerenciador de Chamados de TI

Sistema web para abertura e acompanhamento de chamados de TI, com painel de atendimento, controle de SLA (48 horas úteis), relatórios em Excel e notificações.

- **Frontend:** React 19 + Vite (`Frontend/`)
- **Backend:** Node.js + Express 5 (`Backend/`), com dados em arquivos JSON

## Perfis de acesso

| Perfil | O que pode fazer |
| --- | --- |
| **Usuário** | Abrir chamados e acompanhar os próprios chamados |
| **Analista de TI** | Tudo do usuário + Painel TI (ver todos os chamados, mudar status, responder e fechar) e Histórico |
| **Administrador** | Tudo do analista + gestão de usuários, relatório de SLA e rotinas diárias fixas |

O primeiro administrador é definido no `Backend/.env`. Os outros usuários são gerenciados por ele na tela **Usuários**: cadastrar, mudar o perfil, desativar/reativar e redefinir a senha (é assim que se atende o "Esqueceu a senha?"). Usuário desativado perde o acesso na hora, e mudança de perfil vale sem precisar entrar de novo.

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
- **SLA:** 48 horas úteis, de segunda a sexta, das 8h às 18h, sem contar feriados nacionais (incluindo a Sexta-feira Santa). O fuso é definido por `TZ` (padrão `America/Sao_Paulo`). Carnaval, Corpus Christi e feriados locais podem ser incluídos com `SLA_FERIADOS_MOVEIS` e `SLA_FERIADOS_EXTRAS` (veja o `.env.example`).
- **Fechamento:** só a equipe de TI altera chamados, e fechar exige uma resposta. Data de fechamento, responsável e SLA violado são calculados pelo servidor.
- **Rotinas fixas:** em cada dia útil, a partir das 7h30, o servidor cria 4 chamados de rotina visíveis só para administradores (verifica a cada 5 minutos, mesmo sem ninguém acessar). Rotinas de dias anteriores que ficaram abertas são encerradas automaticamente, e as rotinas não entram no relatório de SLA.
- **Notificações:** ficam no backend (`notificationsStore.json`) e são atualizadas a cada 20 segundos, então chegam à equipe de TI em qualquer computador. Quem abre um chamado não recebe o aviso de "novo chamado" do próprio pedido.

## Dados

Os arquivos em `Backend/src/data/*.json` são a base de dados e **não vão para o Git**. Faça backup dessa pasta. A gravação é atômica e passa por uma fila, então acessos simultâneos não corrompem nem apagam os dados.

## API

| Método | Rota | Acesso |
| --- | --- | --- |
| `POST` | `/api/auth/login` | público |
| `GET` | `/api/auth/me` | logado |
| `POST` | `/api/auth/register` | administrador |
| `GET` | `/api/auth/users` | administrador |
| `PATCH` | `/api/auth/users/:id` | administrador (`role`, `active`, `password`) |
| `GET` | `/api/chamados` | logado (cada perfil vê o que pode) |
| `POST` | `/api/chamados` | logado |
| `PATCH` | `/api/chamados/:id` | TI (só `status` e `resposta`) |
| `GET` | `/api/notifications` | logado |
| `POST` | `/api/notifications/read` | logado (`ids` ou `all: true`) |
| `POST` | `/api/notifications/clear` | logado |
| `GET` | `/api/health` | público |

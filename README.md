# Commercial Center

Aplicacao web interna de gestao comercial integrada ao Chatwoot.
Desenvolvida com Node.js/Express (backend), Prisma/PostgreSQL e Vite/React (frontend).

## Rodando com Docker Compose

```bash
docker compose up --build
```

Aplicacao: `http://localhost:3000`

Banco PostgreSQL:
- host: `localhost`
- porta: `5433`
- database: `lead_mgmt`

## Imagem unica da aplicacao

O deploy foi preparado para gerar uma unica imagem que:
- compila o frontend
- serve a SPA pelo Express
- expoe a API no mesmo host em `/api`
- executa `prisma db push` ao iniciar o container

Build local:

```bash
docker build -t lead-mgmt:latest .
```

## Docker Swarm com Traefik

O arquivo [docker-stack.yml](/c:/Users/arthw/OneDrive/Desktop/dev/projeto-lead-mgmt/docker-stack.yml) usa as redes `interna` e `externa`, com labels do Traefik para publicar o frontend.

Exemplo:

```bash
cp .env.example .env
docker stack deploy -c docker-stack.yml lead-mgmt
```

Defina pelo menos:
- `APP_IMAGE`
- `FRONTEND_HOST`
- `POSTGRES_PASSWORD`

## GitHub Workflow

O workflow [.github/workflows/code-review.yml](/c:/Users/arthw/OneDrive/Desktop/dev/projeto-lead-mgmt/.github/workflows/code-review.yml) executa:
- review automatizado do frontend via `reviewdog` + ESLint em pull requests
- validacao do schema Prisma
- checagem de sintaxe do backend
- lint e build do frontend

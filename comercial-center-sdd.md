# COMMERCIAL CENTER
*Software Design Document (SDD)*

Versão 1.1 | Abril 2026

| **Projeto** | Commercial Center |
|---|---|
| **Stack** | React + Node.js/Express |
| **Integração** | Chatwoot fazer.ai |
| **Documento** | SDD — Software Design Document |
| **Status** | Em Desenvolvimento |

---

## 1. Visão Geral do Produto

O Commercial Center é uma aplicação web interna que centraliza a **gestão e visualização** comercial de leads, conectando-se ao Chatwoot (instância fazer.ai) via API REST. O objetivo é oferecer uma interface dedicada ao time de vendas para **monitorar** o pipeline e os agentes — sem substituir ou duplicar as operações do Chatwoot.

> **Princípio fundamental desta versão:** O Commercial Center é um **painel de gestão e observabilidade**. O controle do Kanban (movimentação de estágios, edição de labels, mudança de status) é feito **diretamente no Chatwoot**. O sistema apenas lê, exibe e organiza essas informações para facilitar a tomada de decisão do time comercial.

### 1.1 Objetivos Principais

- Visualizar o pipeline de vendas em um Kanban **somente leitura**, espelhando as Labels do Chatwoot
- Navegar rapidamente para qualquer conversa no Chatwoot a partir dos cards
- Cadastrar e encaminhar novos leads diretamente para conversas/agentes
- Monitorar a performance individual dos agentes em tempo real
- Configurar e gerenciar a conexão com o Chatwoot de forma segura

### 1.2 O que o sistema NÃO faz (decisão de escopo)

O Commercial Center **não** move cards entre colunas, **não** altera labels de conversas e **não** muda o status de conversas via API. Toda essa operação permanece no Chatwoot, que é a fonte de verdade. O sistema apenas reflete o estado atual.

### 1.3 Escopo desta Versão (v1.1)

> 📌 O projeto será entregue em módulos incrementais. O Módulo 0 (Configuração) é o pré-requisito para todos os demais.

| **Módulo** | **Nome** | **Descrição** | **Prioridade** |
|---|---|---|---|
| M0 | Configuração & Conexão | Gerenciamento de credenciais e teste de conectividade com o Chatwoot | Alta |
| M1 | Kanban de Leads (Leitura) | Visualização do pipeline por estágio (Labels), com link direto para o Chatwoot | Alta |
| M2 | Gestão de Agentes | Performance, carga de trabalho e métricas por agente | Média |
| M3 | Cadastro de Leads | Criação de contatos e abertura de conversas via API | Média |

---

## 2. Arquitetura do Sistema

### 2.1 Stack Tecnológico

| **Camada** | **Tecnologia** | **Responsabilidade** |
|---|---|---|
| Frontend | React (Vite) | Interface do usuário, Kanban visual, dashboards |
| Backend | Node.js + Express | Proxy de API, autenticação, lógica de negócio |
| Comunicação | REST / Fetch API | Requisições ao Chatwoot via backend |
| Estado | Context API + React Query | Cache de dados, estado global da aplicação |
| Persistência local | localStorage / .env | Credenciais (token criptografado), preferências UI |
| Integração | Chatwoot fazer.ai API v1 | Fonte de dados para conversas, contatos e agentes |

### 2.2 Diagrama de Fluxo de Dados

> 📌 Toda comunicação com o Chatwoot é feita pelo backend Node/Express, nunca diretamente do browser, para proteger o API Token.

```
React (Browser)  →  Express Backend  →  Chatwoot fazer.ai API  →  Resposta JSON
                         ↑
              Apenas leitura de dados.
        Operações de escrita (mover cards,
        editar labels) são feitas no Chatwoot.
```

### 2.3 Estrutura de Pastas

| **Caminho** | **Descrição** |
|---|---|
| /frontend/src/pages/ | Páginas principais: Config, Kanban, Agentes, Leads |
| /frontend/src/components/ | Componentes reutilizáveis (KanbanCard, AgentCard, etc.) |
| /frontend/src/services/ | Funções de chamada ao backend (api.js) |
| /frontend/src/context/ | Contextos globais: AuthContext, ChatwootContext |
| /backend/routes/ | Rotas Express: /chatwoot, /leads, /agents |
| /backend/services/chatwoot.js | Wrapper da API do Chatwoot (todas as chamadas externas) |
| /backend/.env | API_TOKEN, ACCOUNT_ID, CHATWOOT_BASE_URL |

---

## 3. Módulo 0 — Configuração & Conexão (M0)

> 📌 Este é o ponto de partida obrigatório. Sem as credenciais válidas configuradas, nenhum outro módulo funcionará.

### 3.1 Descrição Funcional

O M0 permite que o usuário (administrador) configure as credenciais da instância Chatwoot fazer.ai, teste a conexão e salve os dados de forma segura. Esta tela é acessível pelo menu de configurações e deve ser completada antes do primeiro uso.

### 3.2 Informações Necessárias

| **Campo** | **Descrição** | **Onde Obter** | **Obrigatório** |
|---|---|---|---|
| CHATWOOT_BASE_URL | URL base da instância fazer.ai | Ex: https://app.fazer.ai | Sim |
| ACCOUNT_ID | ID numérico da conta Chatwoot | Settings > Account > ID na URL | Sim |
| API_ACCESS_TOKEN | Token de acesso do agente/admin | Profile Settings > Access Token | Sim |
| WEBHOOK_SECRET | Secret para verificar webhooks recebidos | Settings > Integrations > Webhooks | Não |

### 3.3 Fluxo de Configuração

1. Usuário acessa **Settings > Chatwoot Connection**
2. Preenche os campos Base URL, Account ID e API Token
3. Clica em "Testar Conexão" — o backend faz uma requisição `GET /api/v1/accounts/{account_id}/agents`
4. Em caso de sucesso (HTTP 200): exibe preview dos agentes encontrados e habilita "Salvar"
5. Em caso de erro: exibe mensagem descritiva (401 = token inválido, 404 = URL ou Account ID errado)
6. Ao salvar: credenciais são persistidas no `.env` do backend (nunca expostas ao frontend)

### 3.4 Endpoints da API Utilizados (M0)

| **Método** | **Endpoint Chatwoot** | **Uso no M0** |
|---|---|---|
| GET | /api/v1/accounts/{id}/agents | Teste de conectividade e listagem de agentes |
| GET | /api/v1/profile | Validação do token (retorna dados do usuário autenticado) |
| GET | /api/v1/accounts/{id}/labels | Verificação das labels/estágios configuradas |

### 3.5 Regras de Negócio (M0)

- O botão "Salvar" só é habilitado após um teste de conexão bem-sucedido
- O API Token deve ser armazenado apenas no backend, nunca enviado ao cliente
- Se as credenciais já existirem, exibir status de conexão ativa na tela de configuração
- Qualquer alteração nas credenciais exige novo teste antes de salvar

---

## 4. Módulo 1 — Kanban de Leads (M1) — Visualização & Gestão

### 4.1 Descrição Funcional

O Kanban exibe uma visão consolidada do pipeline de vendas, organizando as conversas do Chatwoot por Label (estágio). Cada card representa uma conversa e exibe informações-chave para o time comercial.

> **Importante:** O Kanban do Commercial Center é **somente leitura**. Os cards **não** podem ser arrastados entre colunas pela interface do sistema. Para mover um lead de estágio, o usuário deve acessar a conversa diretamente no Chatwoot. O sistema fornece um link direto para cada conversa para facilitar essa navegação.
>
> Essa decisão mantém o Chatwoot como única fonte de verdade e evita conflitos de estado entre os dois sistemas.

### 4.2 Mapeamento Labels → Colunas

| **Coluna (Label)** | **Significado** | **Cor Sugerida** |
|---|---|---|
| novo-lead | Lead acabou de entrar | #4A90E2 (azul) |
| qualificado | Lead validado pelo time | #F5A623 (laranja) |
| proposta | Proposta enviada | #7B68EE (roxo) |
| fechado | Negócio ganho | #2ECC71 (verde) |
| perdido | Negócio não concluído | #E74C3C (vermelho) |

> A ordem das colunas é configurável no sistema (preferência salva localmente no frontend).

### 4.3 Dados Exibidos em Cada Card

- Nome do contato
- Agente responsável (avatar + nome)
- Inbox de origem (WhatsApp, E-mail, etc.)
- Tempo desde a última mensagem
- Número de mensagens não lidas
- Prioridade (se configurada no Chatwoot)
- **Link direto para a conversa no Chatwoot**

### 4.4 Ações Disponíveis no Kanban

| **Ação** | **Gatilho** | **Comportamento** |
|---|---|---|
| Abrir no Chatwoot | Botão/clique no card | Abre a conversa diretamente no Chatwoot em nova aba |
| Ver detalhes do contato | Ícone de contato no card | Exibe modal com dados do contato (somente leitura) |
| Filtrar por agente | Filtro no header | Filtragem local dos dados carregados |
| Buscar por nome/telefone | Campo de busca | GET /contacts/search?q={query} |
| Atualizar dados | Botão "Refresh" ou auto-refresh | Recarrega as conversas do Chatwoot |

> ⚠️ **Não há drag & drop.** Mover cards e alterar labels é responsabilidade do Chatwoot. O sistema reflete o estado atual das conversas após cada atualização.

### 4.5 Estratégia de Atualização de Dados

O Kanban precisa refletir o estado atual do Chatwoot, já que as alterações são feitas lá. Para isso:

- **Auto-refresh configurável:** O sistema recarrega os dados do Chatwoot em intervalos definidos pelo usuário (ex: a cada 30s, 1min, 5min).
- **Refresh manual:** Botão visível no header do Kanban para atualização imediata.
- **Webhooks (Sprint 6):** Futuramente, o Chatwoot pode notificar o backend via webhook quando uma conversa mudar de label, disparando atualização em tempo real.

### 4.6 Endpoints da API Utilizados (M1)

| **Método** | **Endpoint** | **Uso** |
|---|---|---|
| GET | /api/v1/accounts/{id}/conversations | Listar todas as conversas ativas |
| GET | /api/v1/accounts/{id}/conversations?labels[]=novo-lead | Buscar conversas de uma coluna específica |
| GET | /api/v1/accounts/{id}/conversations/{id}/messages | Histórico de mensagens (modal de preview) |
| GET | /api/v1/accounts/{id}/labels | Listar labels disponíveis (colunas do Kanban) |
| GET | /api/v1/accounts/{id}/contacts/{id} | Detalhes do contato (modal somente leitura) |
| GET | /api/v1/accounts/{id}/contacts/search | Busca de contatos por nome/telefone |

> ℹ️ **Sem chamadas de escrita no M1.** Endpoints `POST`, `DELETE` ou `PATCH` relacionados a labels e status de conversas não são utilizados por este módulo.

---

## 5. Módulo 2 — Gestão de Agentes (M2)

### 5.1 Descrição Funcional

Painel de performance dos agentes com métricas extraídas da API de Reports do Chatwoot. Permite ao gestor visualizar carga de trabalho, tempos de resposta e resoluções por agente.

### 5.2 Métricas por Agente

| **Métrica** | **Fonte** | **Periodicidade** |
|---|---|---|
| Conversas abertas atribuídas | GET /conversations?assignee_type=assigned | Tempo real |
| Total de conversas resolvidas | Reports API v2 — Agent Summary | Por período |
| Tempo médio de primeira resposta | Reports API v2 — Agent Summary | Por período |
| Tempo médio de resolução | Reports API v2 — Agent Summary | Por período |
| Volume de mensagens enviadas | Reports API v2 — Agent Summary | Por período |
| CSAT (satisfação do cliente) | GET /reports/agents/satisfaction | Por período |

### 5.3 Ações Disponíveis no Painel de Agentes

- Filtrar métricas por período (hoje, semana, mês)
- Visualizar status do agente (online/offline/busy)
- Acessar lista de conversas ativas de um agente específico
- **Link direto para o Chatwoot** para reatribuição manual de conversas

> ℹ️ A reatribuição de conversas entre agentes deve ser feita no Chatwoot. O painel de agentes no Commercial Center é focado em observabilidade e diagnóstico de carga.

### 5.4 Endpoints Utilizados (M2)

| **Método** | **Endpoint** | **Uso** |
|---|---|---|
| GET | /api/v1/accounts/{id}/agents | Listar todos os agentes |
| GET | /api/v2/accounts/{id}/reports/agents/summary | Resumo de métricas por agente |
| GET | /api/v1/accounts/{id}/conversations?assignee_type=assigned | Conversas ativas por agente |

---

## 6. Módulo 3 — Cadastro & Envio de Leads (M3)

### 6.1 Descrição Funcional

Formulário para cadastrar um novo lead diretamente no Chatwoot: cria o contato, cria a conversa em um inbox e opcionalmente atribui um agente. O lead já entra diretamente em uma coluna do Kanban (via label inicial aplicada na criação).

> ℹ️ Esta é a **única operação de escrita** do Commercial Center no Chatwoot. O fluxo de criação é atômico e controlado, sem expor ao usuário a complexidade da API subjacente.

### 6.2 Fluxo de Criação de Lead

1. Usuário preenche o formulário: nome, telefone/e-mail, origem, agente responsável, estágio inicial
2. Backend verifica se o contato já existe: `GET /contacts/search?q={phone}`
3. Se não existe: `POST /contacts` → cria novo contato
4. `POST /contacts/{id}/contact_inboxes` → associa o contato ao inbox selecionado
5. `POST /conversations` → cria a conversa com o `source_id` obtido acima
6. `POST /conversations/{id}/labels` → aplica a label do estágio inicial escolhido
7. Se agente foi selecionado: `POST /conversations/{id}/assignments`

### 6.3 Campos do Formulário de Lead

| **Campo** | **Tipo** | **Obrigatório** | **Mapeamento Chatwoot** |
|---|---|---|---|
| Nome completo | Texto | Sim | contact.name |
| Telefone | Texto (máscarado) | Condicional | contact.phone_number |
| E-mail | E-mail | Condicional | contact.email |
| Inbox de destino | Select | Sim | conversation.inbox_id |
| Agente responsável | Select | Não | conversation.assignee_id |
| Estágio inicial | Select (labels) | Sim | conversation.labels[] |
| Observação inicial | Textarea | Não | Primeira mensagem (type: outgoing) |

---

## 7. Segurança & Boas Práticas

### 7.1 Proteção de Credenciais

- O API Token do Chatwoot é armazenado exclusivamente em variáveis de ambiente no backend (`.env`)
- O frontend nunca recebe o token diretamente — todas as chamadas passam pelo Express
- O backend valida cada requisição antes de repassar ao Chatwoot
- Em produção, HTTPS obrigatório em todas as comunicações

### 7.2 Autenticação no Commercial Center

- O próprio app deve ter autenticação básica (JWT ou sessão) para proteger o acesso ao painel
- Apenas usuários autenticados acessam as rotas da API interna

### 7.3 Rate Limiting & Erros

- Implementar retry com backoff exponencial para erros 429 (Too Many Requests) do Chatwoot
- Todos os erros da API Chatwoot devem ser mapeados para mensagens amigáveis no frontend
- Logar erros no backend sem expor detalhes sensíveis ao cliente

---

## 8. Roadmap de Implementação

> 📌 Cada sprint pode durar 1–2 semanas dependendo da disponibilidade. Os módulos são independentes após o M0.

| **Sprint** | **Módulo** | **Entregáveis** | **Dependência** |
|---|---|---|---|
| Sprint 1 | M0 — Configuração | Tela de config, teste de conexão, persistência de credenciais, status de saúde da API | — |
| Sprint 2 | M1 — Kanban (visualização) | Listagem de conversas por label, cards com dados básicos e link para Chatwoot, filtro por agente | M0 |
| Sprint 3 | M1 — Kanban (refinamentos) | Auto-refresh configurável, busca de contatos, modal de preview de conversa | Sprint 2 |
| Sprint 4 | M2 — Agentes | Dashboard de métricas, listagem de conversas ativas | M0 |
| Sprint 5 | M3 — Leads | Formulário de cadastro completo, fluxo de criação de contato + conversa + label | M0 + M1 |
| Sprint 6 | Refinamentos | Webhooks para updates em tempo real, notificações, UX/UI polimento | Todos |

### 8.1 Próximos Passos Imediatos

- Confirmar URL base e obter as credenciais da instância fazer.ai
- Criar o projeto base (Vite + React / Express)
- Implementar o wrapper `chatwoot.js` no backend com as primeiras 3 rotas do M0
- Construir a tela de configuração no frontend e testar o fluxo end-to-end
- Definir as Labels exatas que serão usadas como colunas do Kanban (ex: novo-lead, qualificado, proposta, fechado, perdido)

---

*Commercial Center SDD v1.1 • Atualizado em Abril 2026 • Documento interno*
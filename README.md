# Workshop DAO — Governança Descentralizada na Prática

Stack: **Solidity 0.8.24 · OpenZeppelin v5 · Hardhat · Rede Sepolia**

---

## Estrutura do projeto

```
workshop-dao/
├── contracts/
│   ├── GovToken.sol               ← Token ERC20Votes (wDAO) com claimAndDelegate()
│   ├── GovernorCountingMulti.sol  ← Módulo de contagem multi-candidato (suporte a até 255)
│   ├── WorkshopGovernor.sol       ← Motor de governança (OZ Governor modular)
│   └── VotingTarget.sol           ← Alvo trustless das propostas (grava vencedor onchain)
├── scripts/
│   ├── candidatos.js  ← FONTE ÚNICA DE VERDADE da cédula (nomes + descrição)
│   ├── deploy.js      ← Deploy completo (token + timelock + governor + target)
│   ├── propose.js     ← Cria proposta de eleição
│   ├── vote.js        ← Vota via CLI (facilitador/demo)
│   └── execute.js     ← Coloca em fila e executa proposta aprovada
├── test/
│   └── eleicao.test.js  ← Testes end-to-end da eleição
├── frontend/
│   ├── index.html        ← UI do walkthrough (conecta MetaMask, vota ao vivo)
│   ├── config.js         ← Endereços dos contratos e proposalId (não commitado)
│   └── config.example.js ← Modelo do config.js
├── hardhat.config.js
├── package.json
└── .env.example  ← Copie para .env e preencha
```

---

## Pré-requisitos

- Node.js >= 18
- MetaMask instalada no navegador
- Conta com ETH de Sepolia (faucet: https://sepoliafaucet.com)

---

## Configuração (faça antes do workshop)

```bash
# 1. Instalar dependências
npm install

# 2. Configurar variáveis de ambiente
cp .env.example .env
# Edite .env com sua PRIVATE_KEY e SEPOLIA_RPC_URL

# 3. Compilar contratos
npm run compile

# 4. Rodar os testes (opcional, mas recomendado)
npx hardhat test
```

---

## Arquitetura dos contratos

### GovToken (`wDAO`)

Token ERC20Votes com **self-service de distribuição**: qualquer carteira chama `claimAndDelegate()` uma única vez e recebe **100 wDAO** já delegados para si mesma. Isso elimina a necessidade de distribuição manual antes do evento.

### GovernorCountingMulti

Módulo customizado de contagem que substitui o `GovernorCountingSimple` padrão do OpenZeppelin. Em vez dos 3 baldes fixos (For / Against / Abstain), o `support` passado em `castVote()` representa o **índice do candidato** (0 até `numCandidates - 1`). Uma única proposta suporta até 255 candidatos.

### WorkshopGovernor

Governor modular que combina:

| Módulo | Função |
|--------|--------|
| `Governor` | Núcleo: ciclo de propostas |
| `GovernorSettings` | votingDelay / votingPeriod / threshold |
| `GovernorCountingMulti` | Contagem por índice de candidato |
| `GovernorVotes` | Lê voting power do token |
| `GovernorVotesQuorumFraction` | Quórum mínimo de 4% do supply |
| `GovernorTimelockControl` | Integração com o Timelock |

> **Desvio intencional do padrão OZ:** o `_getVotes` lê o poder de voto atual (`getVotes`), não o checkpoint do snapshot. Isso simplifica o fluxo do workshop mas **não deve ser usado em produção** com tokens de valor real — seria vulnerável a ataques de flash loan.

### VotingTarget (trustless)

O contrato-alvo da proposta. Quando a proposta é executada pelo Timelock, ele **não recebe o nome do vencedor por parâmetro** — em vez disso, reconstrói o `proposalId` internamente e consulta `winningCandidate()` diretamente no Governor. O resultado fica registrado onchain sem intervenção humana.

---

## Parâmetros de governança

| Parâmetro | Valor no workshop | Valor em produção |
|-----------|-------------------|-------------------|
| `votingDelay` | 1 bloco (~12 s) | 7200 blocos (~1 dia) |
| `votingPeriod` | 120 blocos (~24 min) | 50400 blocos (~1 semana) |
| Timelock `minDelay` | 0 s | 172800 s (2 dias) |
| Quórum | 4% do supply | depende da DAO |
| Tokens por participante | 100 wDAO (via `claimAndDelegate`) | — |

Para ajustar, edite o construtor em `WorkshopGovernor.sol`.

---

## Roteiro do Facilitador

### Etapa 1 — Deploy (rode antes do evento)

```bash
npm run deploy:sepolia
```

Saída: endereços de `GovToken`, `Timelock`, `Governor` e `VotingTarget`.
Cole-os no `.env` e em `frontend/config.js` (copie de `frontend/config.example.js`).

### Etapa 2 — Abrir o frontend (no evento)

Abra `frontend/index.html` no navegador — funciona localmente, sem servidor.
Ou sirva com qualquer servidor estático:

```bash
npx serve frontend
# acesse http://localhost:3000
```

Preencha os endereços dos contratos e o Proposal ID (após a Etapa 3).

### Etapa 3 — Criar a proposta (ao vivo no workshop)

```bash
npm run propose
```

Saída: `proposalId` — compartilhe com os participantes (via QR code, chat, etc.)

### Etapa 4 — Participantes recebem tokens e votam (ao vivo)

No frontend, cada participante:
1. Conecta a MetaMask com sua carteira de teste
2. Clica em **"Claim + Delegar"** — recebe 100 wDAO e delega em uma transação
3. Aguarda a proposta ficar `Active` (1 bloco após a criação)
4. Clica no jogador que deseja eleger
5. Confirma a transação na MetaMask

O placar atualiza em tempo real a cada ~12 segundos.

> **Atenção:** o `claimAndDelegate()` precisa ser confirmado **antes** de votar. Se alguém clicar em votar sem ter feito o claim, o voting power será zero.

### Etapa 5 — Executar resultado (ao vivo, se houver tempo)

```bash
npm run execute
```

O contrato reconstrói o vencedor internamente (trustless) e grava onchain o nome do jogador eleito em `VotingTarget.vencedor`.

---

## Candidatos (Copa 2026 — Seleção Brasileira)

A cédula está definida em `scripts/candidatos.js`, que é a **fonte única de verdade** para os 27 jogadores. O índice de cada nome nesse array é o `support` enviado em `castVote()`. A ordem deve ser idêntica no frontend (`config.js`) e nos contratos.

| Posição | Índices |
|---------|---------|
| Goleiros | 0–2 |
| Defensores | 3–10 |
| Meio-campistas | 11–16 |
| Atacantes | 17–26 |

---

## Troubleshooting

**`hardhat: not found`**
O Hardhat fica dentro de `node_modules/.bin`, não no PATH global.
Todos os scripts do `package.json` já usam `npx hardhat`. Use sempre `npm run compile`, `npm run deploy:sepolia`, etc.

**`Couldn't download compiler`**
O Hardhat baixa o compilador Solidity na primeira compilação.
Certifique-se de ter conexão com a internet e rode `npm run compile` novamente.

**`nonce too low` ou `replacement transaction underpriced`**
Aguarde alguns segundos e tente novamente — a rede Sepolia pode ter congestionamento.

**`Voting power zero` ao tentar votar**
O participante ainda não chamou `claimAndDelegate()`, ou chamou no mesmo bloco em que a proposta foi criada (o checkpoint ainda não foi registrado).
No frontend, clique em **"Claim + Delegar"** e aguarde a confirmação na MetaMask. Se a proposta já estava ativa antes do claim, o poder de voto não conta para esta proposta — será necessário criar uma nova.

**`JaFezClaim`**
O endereço já chamou `claimAndDelegate()` anteriormente. Cada carteira só pode fazer claim uma vez.

---

## Faucets de Sepolia

- https://sepoliafaucet.com
- https://faucet.sepolia.dev
- https://faucets.chain.link/sepolia

---

## Recursos

- [OpenZeppelin Governor Docs](https://docs.openzeppelin.com/contracts/5.x/governance)
- [Hardhat Docs](https://hardhat.org/docs)
- [Sepolia Etherscan](https://sepolia.etherscan.io)

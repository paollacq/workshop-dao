/**
 * scripts/vote.js
 * Vota em uma proposta ativa.
 * Os participantes usam o frontend; este script é para quem quiser interagir via CLI.
 *
 * Uso:
 *   PROPOSAL_ID=<id> SUPPORT=17 npx hardhat run scripts/vote.js --network sepolia
 */

const { ethers } = require("hardhat");
require("dotenv").config();
const { NOMES_ONCHAIN } = require("./candidatos");

const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS;
const PROPOSAL_ID      = process.env.PROPOSAL_ID;
const SUPPORT          = process.env.SUPPORT ?? "1";

const SUPPORT_IDX = parseInt(SUPPORT ?? "0", 10);

// Estados da proposta (enum ProposalState do Governor)
const STATES = [
  "Pending", "Active", "Canceled", "Defeated",
  "Succeeded", "Queued", "Expired", "Executed"
];

async function main() {
  if (!GOVERNOR_ADDRESS || !PROPOSAL_ID) {
    throw new Error("Configure GOVERNOR_ADDRESS e PROPOSAL_ID no .env ou via variável de ambiente");
  }

  const [voter] = await ethers.getSigners();
  const governor = await ethers.getContractAt("WorkshopGovernor", GOVERNOR_ADDRESS);

  // Estado atual da proposta
  const state = await governor.state(PROPOSAL_ID);
  console.log(`\nEstado da proposta : ${STATES[Number(state)]} (${state})`);

  if (state !== 1n) {
    throw new Error(`Proposta não está Active. Estado atual: ${STATES[Number(state)]}`);
  }

  // Verificar se o índice do candidato é válido
  const numCandidates = await governor.numCandidates();
  if (SUPPORT_IDX < 0 || SUPPORT_IDX >= Number(numCandidates)) {
    throw new Error(
      `SUPPORT inválido: ${SUPPORT_IDX}. Use um índice entre 0 e ${Number(numCandidates) - 1}.\n` +
      `Ver candidatos.js para a lista completa.`
    );
  }
  const nomeCandidato = NOMES_ONCHAIN[SUPPORT_IDX];

  // Verificar se já votou
  const jaVotou = await governor.hasVoted(PROPOSAL_ID, voter.address);
  if (jaVotou) {
    console.log(" Este endereço já votou nesta proposta.");
    return;
  }

  // Verificar voting power
  const snap = await governor.proposalSnapshot(PROPOSAL_ID);
  const vp   = await governor.getVotes(voter.address, snap);
  console.log(`Voter            : ${voter.address}`);
  console.log(`Voting power     : ${ethers.formatEther(vp)} wDAO`);
  console.log(`Voto no candidato: [${SUPPORT_IDX}] ${nomeCandidato}`);

  if (vp === 0n) {
    throw new Error("Voting power zero. Você delegou seus tokens antes desta proposta ser criada?");
  }

  const tx = await governor.castVote(PROPOSAL_ID, SUPPORT_IDX);
  console.log(`\nTx hash : ${tx.hash}`);
  await tx.wait();
  console.log("✓ Voto registrado onchain!\n");

  // Placar atual — proposalVotes() no GovernorCountingMulti retorna
  // uint256[] onde o índice é o candidato (não against/for/abstain)
  const tally = await governor.proposalVotes(PROPOSAL_ID);

  // Montar ranking top-5 por votos
  const rows = Array.from(tally, (v, i) => ({ i, v: BigInt(v) }))
    .sort((a, b) => (b.v > a.v ? 1 : b.v < a.v ? -1 : 0))
    .slice(0, 5);

  console.log("\nPlacar atual (top 5):");
  for (const { i, v } of rows) {
    const nome = NOMES_ONCHAIN[i] || `candidato ${i}`;
    const fmt  = ethers.formatEther(v);
    const mark = i === SUPPORT_IDX ? " ← seu voto" : "";
    console.log(`  [${String(i).padStart(2)}] ${nome.padEnd(32)} ${fmt} wDAO${mark}`);
  }
  console.log();
}

main().catch((err) => { console.error(err); process.exit(1); });
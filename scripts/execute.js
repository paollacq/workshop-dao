/**
 * scripts/execute.js
 * Coloca a proposta aprovada em fila (queue) e depois executa.
 *
 * Fluxo:
 *   1. Verifica se a proposta está Succeeded
 *   2. Chama governor.queue()  proposta entra no Timelock
 *   3. Aguarda o minDelay do Timelock (0 no workshop)
 *   4. Chama governor.execute()  gravarVencedor() é chamado onchain (trustless)
 *
 * Uso:
 *   npx hardhat run scripts/execute.js --network sepolia
 */

const { ethers } = require("hardhat");
require("dotenv").config();
const { DESCRICAO } = require("./candidatos"); // fonte única, mesmo hash que propose e test

const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS;
const TARGET_ADDRESS   = process.env.TARGET_ADDRESS;
const PROPOSAL_ID      = process.env.PROPOSAL_ID;

const STATES = [
  "Pending", "Active", "Canceled", "Defeated",
  "Succeeded", "Queued", "Expired", "Executed"
];

async function main() {
  if (!GOVERNOR_ADDRESS || !TARGET_ADDRESS || !PROPOSAL_ID) {
    throw new Error("Configure GOVERNOR_ADDRESS, TARGET_ADDRESS e PROPOSAL_ID");
  }

  const [facilitador] = await ethers.getSigners();
  const governor = await ethers.getContractAt("WorkshopGovernor", GOVERNOR_ADDRESS);
  const target   = await ethers.getContractAt("VotingTarget", TARGET_ADDRESS);

  console.log(`\nFacilitador : ${facilitador.address}`);

  const state = await governor.state(PROPOSAL_ID);
  console.log(`Estado      : ${STATES[Number(state)]}`);

  // Mesmos parâmetros usados no propose.js — devem ser idênticos para queue/execute
  const descHash     = ethers.id(DESCRICAO);
  const calldata     = target.interface.encodeFunctionData("gravarVencedor", [descHash]);
  const targets      = [await target.getAddress()];
  const values       = [0];
  const calldatas    = [calldata];

  //  Queue 
  if (state === 4n) { // Succeeded
    console.log("\nColocando em fila (queue)...");
    const qTx = await governor.queue(targets, values, calldatas, descHash);
    await qTx.wait();
    console.log(`✓ Em fila. Tx: ${qTx.hash}`);
  } else if (state !== 5n) { // não é Queued
    throw new Error(`Estado inesperado: ${STATES[Number(state)]}. Precisa ser Succeeded ou Queued.`);
  }

  // Em produção haveria um await de blocos/tempo aqui.

  //  Execute 
  console.log("\nExecutando proposta...");
  const eTx = await governor.execute(targets, values, calldatas, descHash);
  await eTx.wait();
  console.log(`✓ Executada! Tx: ${eTx.hash}`);

  // Ler resultado onchain
  const vencedorOnchain = await target.vencedor();
  const blocoOnchain    = await target.blocoExecucao();
  console.log(`\n🏆 Vencedor registrado onchain: "${vencedorOnchain}"`);
  console.log(`   Bloco: ${blocoOnchain}\n`);

  const newState = await governor.state(PROPOSAL_ID);
  console.log(`Estado final da proposta: ${STATES[Number(newState)]}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
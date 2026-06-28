/**
 * scripts/propose.js
 * Cria a proposta "Melhor Jogador da Seleção" na DAO.
 *
 * A proposta codifica uma chamada futura a VotingTarget.gravarVencedor(descriptionHash).
 * Se aprovada e executada, o vencedor é lido trustlessly do Governor e gravado onchain.
 *
 * Uso:
 *   npx hardhat run scripts/propose.js --network sepolia
 *
 * Saída: proposalId (guarde — será usado em vote.js e execute.js)
 */

const { ethers } = require("hardhat");
require("dotenv").config();
const { DESCRICAO } = require("./candidatos"); // fonte única, mesmo hash que test e execute

//  Configuração 
const GOVERNOR_ADDRESS = process.env.GOVERNOR_ADDRESS;
const TARGET_ADDRESS   = process.env.TARGET_ADDRESS;

async function main() {
  if (!GOVERNOR_ADDRESS || !TARGET_ADDRESS) {
    throw new Error("Configure GOVERNOR_ADDRESS e TARGET_ADDRESS no .env");
  }

  const [proponente] = await ethers.getSigners();
  console.log(`\nProponente : ${proponente.address}`);

  const governor = await ethers.getContractAt("WorkshopGovernor", GOVERNOR_ADDRESS);
  const target   = await ethers.getContractAt("VotingTarget", TARGET_ADDRESS);

  // Verificar se o proponente tem voting power
  const block     = await ethers.provider.getBlockNumber();
  const vp        = await governor.getVotes(proponente.address, block - 1);
  const threshold = await governor.proposalThreshold();
  console.log(`Voting power : ${ethers.formatEther(vp)} wDAO`);
  console.log(`Threshold    : ${ethers.formatEther(threshold)} wDAO`);
  if (vp < threshold && threshold > 0n) {
    throw new Error("Voting power insuficiente para propor. Delegate seus tokens primeiro.");
  }

  // descriptionHash é keccak256 da descrição, passado para gravarVencedor
  // para que o contrato possa reconstruir o proposalId internamente (trustless)
  const descriptionHash = ethers.id(DESCRICAO);
  const calldata = target.interface.encodeFunctionData("gravarVencedor", [descriptionHash]);

  console.log("\nCriando proposta...");
  const tx = await governor.propose(
    [await target.getAddress()], // targets
    [0],                         // values (ETH)
    [calldata],                  // calldatas
    DESCRICAO
  );

  console.log(`Tx hash : ${tx.hash}`);
  const receipt = await tx.wait();

  // Extrair proposalId do evento ProposalCreated
  const event = receipt.logs
    .map(log => { try { return governor.interface.parseLog(log); } catch { return null; } })
    .find(e => e?.name === "ProposalCreated");

  const proposalId = event?.args?.proposalId;
  console.log(`\n✓ Proposta criada!`);
  console.log(`  proposalId : ${proposalId}`);

  const delay  = await governor.votingDelay();
  const period = await governor.votingPeriod();
  const start  = BigInt(await ethers.provider.getBlockNumber()) + delay + 1n;
  const end    = start + period;
  console.log(`  Votação abre no bloco : ${start}`);
  console.log(`  Votação fecha no bloco: ${end}`);
  console.log(`\n  👉 Cole este ID no frontend e em vote.js:`);
  console.log(`     PROPOSAL_ID=${proposalId}\n`);
}

main().catch((err) => { console.error(err); process.exit(1); });
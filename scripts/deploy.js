/**
 * scripts/deploy.js
 * Deploy completo da Workshop DAO na Sepolia (ou hardhat local).
 *
 * Ordem de deploy:
 *  1. GovToken           — token de governança com claimAndDelegate()
 *  2. TimelockController — cofre/tesouraria com delay
 *  3. WorkshopGovernor   — motor de governança
 *  4. VotingTarget       — alvo da proposta de eleição
 *  5. Configurações      — permissões do Timelock
 *
 * Não há distribuição manual de tokens. Cada participante chama
 * claimAndDelegate() no frontend e recebe 100 wDAO automaticamente.
 *
 *
 * Uso:
 *   npx hardhat run scripts/deploy.js --network sepolia
 *   npx hardhat run scripts/deploy.js --network hardhat
 */

const { ethers } = require("hardhat");
const { NOMES_ONCHAIN } = require("./candidatos"); // fonte única de verdade da cédula

async function main() {
  const [facilitador] = await ethers.getSigners();
  console.log("       DEPLOY — WORKSHOP DAO               ");
  console.log(`\nFacilitador : ${facilitador.address}`);
  console.log(`Rede        : ${(await ethers.provider.getNetwork()).name}\n`);

  // 1. GovToken 
  console.log("1/5 Deploy GovToken...");
  const GovToken = await ethers.getContractFactory("GovToken");
  const govToken = await GovToken.deploy(facilitador.address);
  await govToken.waitForDeployment();
  console.log(`   ✓ GovToken: ${await govToken.getAddress()}`);

  // 2. TimelockController 
  console.log("2/5 Deploy TimelockController...");
  const Timelock = await ethers.getContractFactory("TimelockController");
  const timelock = await Timelock.deploy(
    0,                         // minDelay (segundos)
    [],                        // proposers (será o Governor — setado depois)
    [],                        // executors (será o Governor — setado depois)
    facilitador.address        // admin inicial (removido depois)
  );
  await timelock.waitForDeployment();
  console.log(`   ✓ Timelock: ${await timelock.getAddress()}`);

  //  3. WorkshopGovernor 
  console.log("3/5 Deploy WorkshopGovernor...");
  const Governor = await ethers.getContractFactory("WorkshopGovernor");
  const governor = await Governor.deploy(
    await govToken.getAddress(),
    await timelock.getAddress(),
    NOMES_ONCHAIN.length          // _numCandidates — deve bater com VotingTarget
  );
  await governor.waitForDeployment();
  console.log(`   ✓ Governor: ${await governor.getAddress()}`);

  // 4. VotingTarget 
  console.log("4/5 Deploy VotingTarget...");
  const Target = await ethers.getContractFactory("VotingTarget");
  const target = await Target.deploy(
    await timelock.getAddress(),  // _timelock
    await governor.getAddress(),  // _governor — consultado para ler o vencedor
    NOMES_ONCHAIN                 // _candidatos — nomes gravados onchain
  );
  await target.waitForDeployment();
  console.log(`   ✓ VotingTarget: ${await target.getAddress()}`);

  //  5. Configurar permissões do Timelock 
  console.log("5/5 Configurando permissões do Timelock...");
  const PROPOSER_ROLE  = await timelock.PROPOSER_ROLE();
  const EXECUTOR_ROLE  = await timelock.EXECUTOR_ROLE();
  const CANCELLER_ROLE = await timelock.CANCELLER_ROLE();
  const ADMIN_ROLE     = await timelock.DEFAULT_ADMIN_ROLE();

  // Governor pode propor e executar no Timelock
  await (await timelock.grantRole(PROPOSER_ROLE,  await governor.getAddress())).wait();
  await (await timelock.grantRole(EXECUTOR_ROLE,  await governor.getAddress())).wait();
  await (await timelock.grantRole(CANCELLER_ROLE, await governor.getAddress())).wait();
  // Revogar admin do facilitador (a DAO fica autônoma)
  await (await timelock.revokeRole(ADMIN_ROLE, facilitador.address)).wait();
  console.log("   ✓ Roles configuradas e admin revogado");

  // Nota: o facilitador já recebeu 100 wDAO e foi auto-delegado no constructor do GovToken.
  // Participantes recebem tokens ao chamar claimAndDelegate() no frontend.
  console.log("   ✓ Facilitador com 100 wDAO e auto-delegado (via constructor)");

  // ── Resumo ───────────────────────────────────────────────────────
  console.log("     ENDEREÇOS — cole no .env e frontend  ");
  console.log(` GOVTOKEN_ADDRESS = ${await govToken.getAddress()}`);
  console.log(` TIMELOCK_ADDRESS = ${await timelock.getAddress()}`);
  console.log(` GOVERNOR_ADDRESS = ${await governor.getAddress()}`);
  console.log(` TARGET_ADDRESS   = ${await target.getAddress()}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
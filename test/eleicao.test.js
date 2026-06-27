/**
 * test/eleicao.test.js
 * Valida a eleição multi-candidato e o registro trustless do vencedor.
 *
 *   npx hardhat test
 *
 * CORREÇÕES v2:
 *   - Importa scripts/candidatos.js (que antes era inexistente).
 *   - Atualizado para 27 candidatos (Rodrygo adicionado em idx 25, Vini Jr. em idx 26).
 *   - Índices de voto atualizados: Endrick=17, Vini=26.
 */
const { expect } = require("chai");
const { ethers, network } = require("hardhat");
const { NOMES_ONCHAIN, DESCRICAO } = require("../scripts/candidatos");

const mine = (n) => network.provider.send("hardhat_mine", ["0x" + n.toString(16)]);
const ACTIVE = 1, SUCCEEDED = 4, EXECUTED = 7;

async function deployDAO() {
  const [fac, v1, v2, v3] = await ethers.getSigners();

  const token = await (await ethers.getContractFactory("GovToken")).deploy(fac.address);
  const timelock = await (await ethers.getContractFactory("TimelockController"))
    .deploy(0, [], [], fac.address);
  const gov = await (await ethers.getContractFactory("WorkshopGovernor"))
    .deploy(await token.getAddress(), await timelock.getAddress(), NOMES_ONCHAIN.length);
  const target = await (await ethers.getContractFactory("VotingTarget"))
    .deploy(await timelock.getAddress(), await gov.getAddress(), NOMES_ONCHAIN);

  // Governor precisa das roles de PROPOSER e EXECUTOR no Timelock.
  // Em produção, revogar também a ADMIN_ROLE do deployer para descentralizar.
  await timelock.grantRole(await timelock.PROPOSER_ROLE(), await gov.getAddress());
  await timelock.grantRole(await timelock.EXECUTOR_ROLE(), await gov.getAddress());

  const dec = await token.decimals();
  // Cada participante chama claimAndDelegate() — recebe 100 wDAO e delega em 1 tx.
  // O facilitador já recebeu 100 wDAO e foi auto-delegado no constructor.
  await token.connect(v1).claimAndDelegate();
  await token.connect(v2).claimAndDelegate();
  await token.connect(v3).claimAndDelegate();
  await mine(1); // avança um bloco para consolidar os checkpoints

  return { fac, v1, v2, v3, token, timelock, gov, target, dec };
}

async function abrirProposta(gov, target) {
  const descHash = ethers.id(DESCRICAO);
  const calldata = target.interface.encodeFunctionData("gravarVencedor", [descHash]);
  const args = [[await target.getAddress()], [0], [calldata], descHash];
  const tx = await gov.propose(args[0], args[1], args[2], DESCRICAO);
  const rc = await tx.wait();
  const ev = rc.logs
    .map((l) => { try { return gov.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === "ProposalCreated");
  return { pid: ev.args.proposalId, args };
}

describe("Eleição multi-candidato (GovernorCountingMulti + VotingTarget trustless)", () => {

  it("deve ter 27 candidatos no Governor e no VotingTarget", async () => {
    const { gov, target } = await deployDAO();
    // CORREÇÃO: era 26, agora 27 (Rodrygo adicionado)
    expect(await gov.numCandidates()).to.equal(27);
    expect(await target.numCandidatos()).to.equal(27);
  });

  it("proposalId é reconstruível pelos mesmos parâmetros", async () => {
    const { gov, target } = await deployDAO();
    const { pid, args } = await abrirProposta(gov, target);
    expect(pid).to.equal(await gov.hashProposal(...args));
  });

  it("conta votos por candidato e grava o vencedor (argmax) onchain sem digitar nome", async () => {
    const { gov, target } = await deployDAO();
    const { pid, args } = await abrirProposta(gov, target);

    await mine(2); // avança além do votingDelay (1 bloco)
    expect(await gov.state(pid)).to.equal(ACTIVE);

    const [, v1, v2, v3] = await ethers.getSigners();
    // Facilitador (100 wDAO, via constructor) → Endrick (idx 17)
    await gov.castVote(pid, 17);
    // v1 (100) e v2 (100) → Vini Jr. (idx 26)
    await gov.connect(v1).castVote(pid, 26);
    await gov.connect(v2).castVote(pid, 26);
    // v3 (100) → Endrick (idx 17)
    await gov.connect(v3).castVote(pid, 17);

    // Endrick: 100 + 100 = 200  |  Vini: 100 + 100 = 200 — empate: vence menor idx (17)
    const [wIdx] = await gov.winningCandidate(pid);
    expect(wIdx).to.equal(17); // Endrick

    // Avança além do votingPeriod (120 blocos) + 1
    await mine(122);
    expect(await gov.state(pid)).to.equal(SUCCEEDED);

    await gov.queue(...args);
    await gov.execute(...args);

    expect(await gov.state(pid)).to.equal(EXECUTED);
    // NOMES_ONCHAIN[17] === "Endrick (Lyon)"
    expect(await target.vencedor()).to.equal(NOMES_ONCHAIN[17]);
    expect(await target.vencedorIndice()).to.equal(17);
  });

  it("rejeita support fora da cédula (idx >= numCandidates)", async () => {
    const { gov, target } = await deployDAO();
    const { pid } = await abrirProposta(gov, target);
    await mine(2);

    const [, v1] = await ethers.getSigners();
    // 27 é o primeiro índice inválido (candidatos válidos: 0-26)
    await expect(gov.connect(v1).castVote(pid, 27))
      .to.be.revertedWithCustomError(gov, "GovernorInvalidVoteType");
  });

  it("rejeita voto duplo do mesmo endereço", async () => {
    const { gov, target } = await deployDAO();
    const { pid } = await abrirProposta(gov, target);
    await mine(2);

    const [, v1] = await ethers.getSigners();
    await gov.connect(v1).castVote(pid, 3);  // primeiro voto: válido
    await expect(gov.connect(v1).castVote(pid, 4))  // segundo voto: reverte
      .to.be.revertedWithCustomError(gov, "GovernorAlreadyCastVote");
  });

  it("VotingTarget rejeita chamada fora do Timelock", async () => {
    const { gov, target } = await deployDAO();
    const descHash = ethers.id(DESCRICAO);
    const [fac] = await ethers.getSigners();
    await expect(target.connect(fac).gravarVencedor(descHash))
      .to.be.revertedWithCustomError(target, "ApenasTimelock");
  });
});
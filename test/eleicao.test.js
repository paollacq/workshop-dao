/**
 * test/eleicao.test.js
 * Valida a eleição multi-candidato e o registro trustless do vencedor.
 *
 *   npx hardhat test
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

  await timelock.grantRole(await timelock.PROPOSER_ROLE(), await gov.getAddress());
  await timelock.grantRole(await timelock.EXECUTOR_ROLE(), await gov.getAddress());

  const dec = await token.decimals();
  const amt = (x) => BigInt(x) * 10n ** dec;
  await token.transfer(v1.address, amt(30));
  await token.transfer(v2.address, amt(20));
  await token.transfer(v3.address, amt(10));
  await token.delegate(fac.address);
  await token.connect(v1).delegate(v1.address);
  await token.connect(v2).delegate(v2.address);
  await token.connect(v3).delegate(v3.address);
  await mine(1);

  return { fac, v1, v2, v3, token, timelock, gov, target, dec };
}

async function abrirProposta(gov, target) {
  const descHash = ethers.id(DESCRICAO);
  const calldata = target.interface.encodeFunctionData("gravarVencedor", [descHash]);
  const args = [[await target.getAddress()], [0], [calldata], descHash];
  const tx = await gov.propose(args[0], args[1], args[2], DESCRICAO);
  const rc = await tx.wait();
  const ev = rc.logs.map((l) => { try { return gov.interface.parseLog(l); } catch { return null; } })
    .find((e) => e?.name === "ProposalCreated");
  return { pid: ev.args.proposalId, args };
}

describe("Eleição multi-candidato (GovernorCountingMulti + VotingTarget trustless)", () => {
  it("conta votos por candidato e grava o vencedor (argmax) onchain sem digitar nome", async () => {
    const { gov, target } = await deployDAO();
    expect(await gov.numCandidates()).to.equal(26);
    expect(await target.numCandidatos()).to.equal(26);

    const { pid, args } = await abrirProposta(gov, target);
    expect(pid).to.equal(await gov.hashProposal(...args)); // proposalId reconstrutível

    await mine(2);
    expect(await gov.state(pid)).to.equal(ACTIVE);

    const [, v1, v2, v3] = await ethers.getSigners();
    await gov.castVote(pid, 17);          // facilitador (940) -> Endrick
    await gov.connect(v1).castVote(pid, 25); // 30 -> Vini
    await gov.connect(v2).castVote(pid, 25); // 20 -> Vini
    await gov.connect(v3).castVote(pid, 17); // 10 -> Endrick

    const [wIdx] = await gov.winningCandidate(pid);
    expect(wIdx).to.equal(17);

    await mine(121);
    expect(await gov.state(pid)).to.equal(SUCCEEDED);

    await gov.queue(...args);
    await gov.execute(...args);

    expect(await gov.state(pid)).to.equal(EXECUTED);
    expect(await target.vencedor()).to.equal(NOMES_ONCHAIN[17]); // "Endrick (Lyon)"
    expect(await target.vencedorIndice()).to.equal(17);
  });

  it("rejeita support fora da cédula e voto duplicado", async () => {
    const { gov, target, v1 } = await deployDAO();
    const { pid } = await abrirProposta(gov, target);
    await mine(2);

    await expect(gov.connect(v1).castVote(pid, 26))
      .to.be.revertedWithCustomError(gov, "GovernorInvalidVoteType");
    await gov.connect(v1).castVote(pid, 3);
    await expect(gov.connect(v1).castVote(pid, 4))
      .to.be.revertedWithCustomError(gov, "GovernorAlreadyCastVote");
  });
});

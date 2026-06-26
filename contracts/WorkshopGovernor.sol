// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/governance/Governor.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorSettings.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotes.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorVotesQuorumFraction.sol";
import "@openzeppelin/contracts/governance/extensions/GovernorTimelockControl.sol";
import "./GovernorCountingMulti.sol";

/**
 * @title WorkshopGovernor — Workshop DAO
 * @notice Governor modular usando os módulos padrão do OpenZeppelin.
 *
 * ARQUITETURA (cada herança = um módulo com função específica):
 *
 *   Governor              núcleo: ciclo de propostas
 *   GovernorSettings      votingDelay/Period/thresh
 *   GovernorCountingMulti  support = índice do candidato (0..N-1)
 *   GovernorVotes         lê voting power do token
 *   GovernorVotesQuorum.. define quórum mínimo
 *   GovernorTimelockCtrl  integra com o Timelock
 *
 * PARÂMETROS PARA O WORKSHOP (valores curtos para demonstração):
 *   votingDelay  : 1 bloco  (12 s na mainnet, imediato no workshop)
 *   votingPeriod : 60 blocos (12 minutos — tempo para todos votarem)
 *   quórum       : 4 % do supply total de wDAO
 *
 * Em produção esses valores seriam muito maiores (dias/semanas).
 */
contract WorkshopGovernor is
    Governor,
    GovernorSettings,
    GovernorCountingMulti,
    GovernorVotes,
    GovernorVotesQuorumFraction,
    GovernorTimelockControl
{
    // Deploy
    /**
     * @param _token         Endereço do GovToken (ERC20Votes)
     * @param _timelock      Endereço do TimelockController
     * @param _numCandidates Quantidade de candidatos da cédula (deve bater com o VotingTarget e o frontend)
     */
    constructor(IVotes _token, TimelockController _timelock, uint8 _numCandidates)
        Governor("WorkshopGovernor")
        GovernorSettings(
            1,   // votingDelay  : blocos até a votação abrir
            120,  // votingPeriod : blocos de janela de votação (12 min)
            0    // proposalThreshold : 0 = qualquer holder pode propor
        )
        GovernorCountingMulti(_numCandidates)
        GovernorVotes(_token)
        GovernorVotesQuorumFraction(4) // 4 % do supply
        GovernorTimelockControl(_timelock)
    {}

    // Overrides de resolução de herança múltipla (exigidos pelo Solidity)

    function votingDelay()
        public view override(Governor, GovernorSettings)
        returns (uint256) { return super.votingDelay(); }

    function votingPeriod()
        public view override(Governor, GovernorSettings)
        returns (uint256) { return super.votingPeriod(); }

    function quorum(uint256 blockNumber)
        public view override(Governor, GovernorVotesQuorumFraction)
        returns (uint256) { return super.quorum(blockNumber); }

    function state(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl)
        returns (ProposalState) { return super.state(proposalId); }

    function proposalNeedsQueuing(uint256 proposalId)
        public view override(Governor, GovernorTimelockControl)
        returns (bool) { return super.proposalNeedsQueuing(proposalId); }

    function proposalThreshold()
        public view override(Governor, GovernorSettings)
        returns (uint256) { return super.proposalThreshold(); }

    function _queueOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl)
        returns (uint48)
    {
        return super._queueOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _executeOperations(
        uint256 proposalId,
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl)
    {
        super._executeOperations(proposalId, targets, values, calldatas, descriptionHash);
    }

    function _cancel(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) internal override(Governor, GovernorTimelockControl)
        returns (uint256)
    {
        return super._cancel(targets, values, calldatas, descriptionHash);
    }

    function _executor()
        internal view override(Governor, GovernorTimelockControl)
        returns (address) { return super._executor(); }
}

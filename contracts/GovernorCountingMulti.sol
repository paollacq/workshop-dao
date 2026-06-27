// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGovernor, Governor} from "@openzeppelin/contracts/governance/Governor.sol";

/**
 * @title GovernorCountingMulti — Workshop DAO
 * @notice Modulo de contagem multi-candidato.
 *
 * POR QUE ESTE MODULO EXISTE
 * ──────────────────────────────────────────────────────────────────
 * O GovernorCountingSimple padrao tem APENAS 3 baldes de voto:
 *   support 0 = Against,  support 1 = For,  support 2 = Abstain.
 * Qualquer support > 2 reverte com GovernorInvalidVoteType.
 * Por isso uma eleicao de 3 candidatos so cabia "encaixando" cada
 * candidato em um balde — e mais de 3 era impossivel.
 *
 * Aqui `support` deixa de ser sim/nao/abstencao e passa a ser o
 * INDICE do candidato (0..numCandidates-1). Uma unica proposta
 * comporta ate 255 candidatos, cada carteira vota uma vez, e o
 * placar por candidato fica correto.
 *
 * SEMANTICA DE RESULTADO
 *   vencedor = candidato com mais votos (argmax)  -> winningCandidate()
 *   quorum   = soma de TODOS os votos >= quorum do snapshot
 *   sucesso  = sempre verdadeiro; nao ha "maioria sim". Quem decide
 *              o resultado e o argmax, e a unica trava de validade
 *              da eleicao e o quorum.
 */
abstract contract GovernorCountingMulti is Governor {
    // Numero de candidatos da cedula. Fixo no deploy (igual ao VotingTarget e ao frontend).
    uint8 public immutable numCandidates;

    struct ProposalVote {
        uint256 totalVotes;                          // soma do voting power de todos os votos
        mapping(uint8 candidateId => uint256) votes; // votos por candidato
        mapping(address voter => bool) hasVoted;     // trava de voto unico
    }

    mapping(uint256 proposalId => ProposalVote) private _proposalVotes;

    constructor(uint8 _numCandidates) {
        require(_numCandidates >= 2, "min 2 candidatos");
        numCandidates = _numCandidates;
    }

    /// @inheritdoc IGovernor
    // solhint-disable-next-line func-name-mixedcase
    function COUNTING_MODE() public pure virtual override returns (string memory) {
        return "support=candidate&quorum=total";
    }

    /// @inheritdoc IGovernor
    function hasVoted(uint256 proposalId, address account) public view virtual override returns (bool) {
        return _proposalVotes[proposalId].hasVoted[account];
    }

    /// @notice Votos de UM candidato especifico.
    function candidateVotes(uint256 proposalId, uint8 candidateId) public view virtual returns (uint256) {
        return _proposalVotes[proposalId].votes[candidateId];
    }

    /// @notice Placar completo: array onde o indice e o id do candidato.
    function proposalVotes(uint256 proposalId) public view virtual returns (uint256[] memory tally) {
        tally = new uint256[](numCandidates);
        ProposalVote storage pv = _proposalVotes[proposalId];
        for (uint256 i = 0; i < numCandidates; i++) {
            tally[i] = pv.votes[uint8(i)];
        }
    }

    /// @notice Total de voting power registrado nesta proposta.
    function totalVotes(uint256 proposalId) public view virtual returns (uint256) {
        return _proposalVotes[proposalId].totalVotes;
    }

    /// @notice Candidato vencedor (argmax). Em empate, vence o menor indice.
    function winningCandidate(uint256 proposalId)
        public
        view
        virtual
        returns (uint8 winner, uint256 votes)
    {
        ProposalVote storage pv = _proposalVotes[proposalId];
        for (uint256 i = 0; i < numCandidates; i++) {
            uint256 v = pv.votes[uint8(i)];
            if (v > votes) {
                votes = v;
                winner = uint8(i);
            }
        }
    }

    /// @inheritdoc Governor
    function _quorumReached(uint256 proposalId) internal view virtual override returns (bool) {
        return _proposalVotes[proposalId].totalVotes >= quorum(proposalSnapshot(proposalId));
    }

    /**
     * @dev See {Governor-_voteSucceeded}.
     *      Numa eleicao multi-candidato nao existe "maioria sim": o vencedor
     *      e o argmax. Portanto o sucesso depende somente do quorum (checado
     *      separadamente pelo Governor). Retornamos sempre true.
     */
    function _voteSucceeded(uint256 /* proposalId */) internal view virtual override returns (bool) {
        return true;
    }

    /**
     * @dev See {Governor-_countVote}. Aqui `support` e o indice do candidato.
     */
    function _countVote(
        uint256 proposalId,
        address account,
        uint8 support,
        uint256 totalWeight,
        bytes memory // params
    ) internal virtual override returns (uint256) {
        ProposalVote storage pv = _proposalVotes[proposalId];

        if (pv.hasVoted[account]) revert GovernorAlreadyCastVote(account);
        if (support >= numCandidates) revert GovernorInvalidVoteType();

        pv.hasVoted[account] = true;
        pv.votes[support] += totalWeight;
        pv.totalVotes += totalWeight;

        return totalWeight;
    }
}

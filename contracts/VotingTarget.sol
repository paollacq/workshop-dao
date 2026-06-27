// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotingTarget — Workshop DAO
 * @notice Contrato-alvo que grava o resultado da eleicao "Melhor Jogador da Selecao" onchain.
 *
 * PAPEL NO WORKSHOP
 * Toda proposta do Governor referencia uma acao concreta: qual contrato chamar,
 * com qual funcao. Este e o "alvo". Quando a proposta e aprovada e executada,
 * o Timelock chama gravarVencedor() aqui.
 *
 * VERSAO TRUSTLESS
 * Ninguem digita o nome do vencedor. O contrato:
 *   1. recebe os nomes dos candidatos no deploy (mesma ordem do Governor e do frontend);
 *   2. ao ser executado, reconstroi o proposalId e pergunta ao Governor quem venceu
 *      (winningCandidate -> argmax dos votos);
 *   3. grava onchain o nome correspondente aquele indice.
 *
 * CORREÇÃO v2:
 *   - Adicionado require(_candidatos.length == numCandidates) no constructor para
 *     garantir que Governor e VotingTarget sempre concordem sobre o numero de candidatos.
 *   - Adicionado guard em gravarVencedor para evitar out-of-bounds em candidatos[idx].
 */

interface IWorkshopGovernor {
    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external pure returns (uint256);

    function winningCandidate(uint256 proposalId)
        external
        view
        returns (uint8 winner, uint256 votes);

    function numCandidates() external view returns (uint8);
}

contract VotingTarget {
    // Apenas o Timelock (executor do Governor) pode gravar o resultado
    address public immutable timelock;
    IWorkshopGovernor public immutable governor;

    // Nomes dos candidatos. indice = id do candidato (igual ao Governor e ao frontend).
    string[] public candidatos;

    // Resultado registrado
    string  public vencedor;       // nome do jogador eleito
    uint8   public vencedorIndice; // indice do vencedor na cedula
    uint256 public vencedorVotos;  // voting power que o vencedor recebeu
    uint256 public blocoExecucao;  // bloco em que o resultado foi registrado

    event VencedorDeclarado(string nome, uint8 indice, uint256 votos, uint256 bloco);

    error ApenasTimelock();
    error IndiceForaDaCedula(uint8 indice, uint256 numCandidatos);

    /**
     * @param _timelock   Endereço do TimelockController (único autorizado a executar)
     * @param _governor   Endereço do WorkshopGovernor (consultado para saber o vencedor)
     * @param _candidatos Nomes dos candidatos, na MESMA ordem do frontend e da cédula do Governor.
     *                    O tamanho DEVE ser igual ao numCandidates do Governor.
     */
    constructor(address _timelock, address _governor, string[] memory _candidatos) {
        require(_candidatos.length >= 2, "min 2 candidatos");

        // CORREÇÃO: garantir consistência entre Governor e VotingTarget no deploy.
        // Se os tamanhos divergirem, gravarVencedor poderia fazer acesso out-of-bounds.
        uint8 numGov = IWorkshopGovernor(_governor).numCandidates();
        require(
            _candidatos.length == numGov,
            "VotingTarget: candidatos.length deve ser igual a numCandidates do Governor"
        );

        timelock   = _timelock;
        governor   = IWorkshopGovernor(_governor);
        candidatos = _candidatos;
    }

    function numCandidatos() external view returns (uint256) {
        return candidatos.length;
    }

    /// @notice Lista completa de nomes (fonte unica de verdade para o indice -> nome).
    function todosCandidatos() external view returns (string[] memory) {
        return candidatos;
    }

    /**
     * @notice Grava o vencedor lido diretamente do Governor (trustless).
     *         A proposta chama esta funcao; o nome NAO vem por parametro.
     * @param descriptionHash keccak256 da descricao usada no propose()/queue()/execute().
     *
     * Como o proposalId e reconstruido:
     *   proposalId = hashProposal([this], [0], [gravarVencedor(descriptionHash)], descriptionHash)
     * Os mesmos parametros usados ao criar a proposta. Sem dependencia circular:
     * descriptionHash = keccak256(descricao), independente do proposalId.
     */
    function gravarVencedor(bytes32 descriptionHash) external {
        if (msg.sender != timelock) revert ApenasTimelock();

        address[] memory targets = new address[](1);
        targets[0] = address(this);
        uint256[] memory values = new uint256[](1);
        values[0] = 0;
        bytes[] memory calldatas = new bytes[](1);
        calldatas[0] = abi.encodeWithSelector(this.gravarVencedor.selector, descriptionHash);

        uint256 proposalId = governor.hashProposal(targets, values, calldatas, descriptionHash);

        (uint8 idx, uint256 votos) = governor.winningCandidate(proposalId);

        // CORREÇÃO: guard explícito — impossível se o constructor já garante consistência,
        // mas mantido como defesa em profundidade caso o contrato seja reutilizado.
        if (idx >= candidatos.length) revert IndiceForaDaCedula(idx, candidatos.length);

        vencedor       = candidatos[idx];
        vencedorIndice = idx;
        vencedorVotos  = votos;
        blocoExecucao  = block.number;

        emit VencedorDeclarado(vencedor, idx, votos, block.number);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title VotingTarget — Workshop DAO
 * @notice Contrato simples que registra o resultado da eleição
 *         "Melhor Jogador da Seleção" onchain.
 *
 * PAPEL NO WORKSHOP:
 * Toda proposta do Governor precisa referenciar uma ação concreta:
 * qual contrato chamar, com qual função.
 * Este é o "alvo" da proposta — quando aprovada e executada,
 * o Governor chama setVencedor() aqui, gravando o resultado na blockchain.
 */
 
contract VotingTarget {
    // Apenas o Timelock (executor do Governor) pode chamar setVencedor()
    address public immutable timelock;

    string  public vencedor;       // nome do jogador eleito
    uint256 public blocoExecucao;  // bloco em que o resultado foi registrado

    event VencedorDeclarado(string nome, uint256 bloco);

    error ApenasTimelock();

    constructor(address _timelock) {
        timelock = _timelock;
    }

    /**
     * @notice Registra o vencedor da eleição.
     *         Chamado pelo Timelock após aprovação e execução da proposta.
     * @param nome Nome do jogador eleito.
     */
    function setVencedor(string calldata nome) external {
        if (msg.sender != timelock) revert ApenasTimelock();
        vencedor = nome;
        blocoExecucao = block.number;
        emit VencedorDeclarado(nome, block.number);
    }
}

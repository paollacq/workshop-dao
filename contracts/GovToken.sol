// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title GovToken — Workshop DAO
 * @notice Token de governança com suporte a snapshots de voting power.
 *
 * CONCEITO-CHAVE 
 * ERC20Votes grava um "checkpoint" a cada transferência:
 * salva (número do bloco, saldo) para cada endereço.
 * O Governor consulta sempre o checkpoint do bloco ANTERIOR
 * à criação de uma proposta — isso impede que alguém compre
 * tokens depois que a proposta foi criada para influenciar o resultado.
 *
 * ATENÇÃO: o holder precisa chamar delegate() (mesmo para si mesmo)
 * antes de poder votar. Tokens não delegados não contam como voting power.
 */
contract GovToken is ERC20, ERC20Permit, ERC20Votes {
    // Deploy
    /**
     * @param initialHolder Carteira que recebe todo o supply inicial.
     *        No workshop, esta será a carteira do facilitador,
     *        que depois distribui tokens para os participantes.
     */
    constructor(address initialHolder)
        ERC20("Workshop DAO Token", "wDAO")
        ERC20Permit("Workshop DAO Token")
    {
        // Supply fixo: 1 000 wDAO (18 casas decimais)
        _mint(initialHolder, 1_000 * 10 ** decimals());
    }

    // Override obrigatório (OZ v5)
    /**
     * @dev ERC20Votes precisa interceptar toda movimentação de tokens
     *      para atualizar o checkpoint. Em OZ v5 isso é feito em _update
     *      (em vez do antigo _afterTokenTransfer).
     */
    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }
}

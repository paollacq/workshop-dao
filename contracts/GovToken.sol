// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/utils/Nonces.sol";

/**
 * @title GovToken — Workshop DAO
 * @notice Token de governança com claim automático.
 *
 * Qualquer carteira chama claimAndDelegate() UMA única vez.
 * O contrato:
 *   1. Verifica que o endereço ainda não fez claim.
 *   2. Minta CLAIM_AMOUNT tokens diretamente para msg.sender.
 *   3. Delega automaticamente para msg.sender (ativa o voting power).
 * Tudo em uma única transação — o participante não precisa de ETH além do gas.
 *
 * CONCEITO-CHAVE: ERC20Votes
 * O Governor consulta o checkpoint do bloco do snapshot para calcular
 * o voting power.
 *
 * SEGURANÇA
 *   - Uma claim por endereço (hasClaimed mapping).
 *   - Não impede Sybil (múltiplas carteiras).
 *   - NÃO use este padrão em produção com tokens de valor real.
 */
contract GovToken is ERC20, ERC20Permit, ERC20Votes {

    /// @notice Quantidade de tokens mintada por claim (100 wDAO).
    uint256 public constant CLAIM_AMOUNT = 100 * 10 ** 18;

    /// @notice Registra quais endereços já fizeram claim.
    mapping(address => bool) public hasClaimed;

    /// @notice Emitido quando um participante faz claim.
    event Claimed(address indexed participant, uint256 amount);

    error JaFezClaim(address participant);

    /**
     * @param facilitador Carteira do facilitador — recebe 100 wDAO iniciais
     *                    e já é auto-delegada para poder criar a proposta.
     */
    constructor(address facilitador)
        ERC20("Workshop DAO Token", "wDAO")
        ERC20Permit("Workshop DAO Token")
    {
        _mint(facilitador, CLAIM_AMOUNT);
        hasClaimed[facilitador] = true;
        _delegate(facilitador, facilitador);
    }

    /**
     * @notice Minta 100 wDAO e delega para si mesmo em uma única transação.
     *         Só pode ser chamado uma vez por endereço.
     *
     */
    function claimAndDelegate() external {
        if (hasClaimed[msg.sender]) revert JaFezClaim(msg.sender);

        hasClaimed[msg.sender] = true;
        _mint(msg.sender, CLAIM_AMOUNT);
        _delegate(msg.sender, msg.sender);

        emit Claimed(msg.sender, CLAIM_AMOUNT);
    }

    //  Overrides obrigatórios (OZ v5) 

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

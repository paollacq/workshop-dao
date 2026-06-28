/**
 * scripts/candidatos.js
 * FONTE ÚNICA DE VERDADE para a cédula da eleição.
 *
 * Este arquivo é importado por:
 *   - scripts/deploy.js     passa NOMES_ONCHAIN ao VotingTarget e numCandidates ao Governor
 *   - scripts/propose.js    usa DESCRICAO para criar a proposta
 *   - test/eleicao.test.js  valida que contratos e resultado batem com estes dados
 *
 * REGRA CRÍTICA:
 *   O índice de cada nome neste array É o `support` enviado em castVote().
 *   A ordem aqui, no frontend (CANDIDATOS[].idx) e no VotingTarget DEVE ser idêntica.
 *   Trocar a ordem = voto computado no jogador errado.
 *
 * Convocação Copa 2026 — Seleção Brasileira
 */

// Nomes gravados onchain
const NOMES_ONCHAIN = [
  // Goleiros  (idx 0-2)
  "Alisson (Liverpool)",           // 0
  "Ederson (Fenerbahçe)",          // 1
  "Weverton (Grêmio)",             // 2
  // Defensores (idx 3-10)
  "Alex Sandro (Flamengo)",        // 3
  "Bremer (Juventus)",             // 4
  "Danilo (Flamengo)",             // 5
  "Douglas Santos (Zenit)",        // 6
  "Gabriel Magalhães (Arsenal)",   // 7
  "Ibañez (Al-Ahli)",              // 8
  "Léo Pereira (Flamengo)",        // 9
  "Marquinhos (PSG)",              // 10
  // Meio-campistas (idx 11-16)
  "Bruno Guimarães (Newcastle)",   // 11
  "Casemiro (Man. United)",        // 12
  "Danilo Santos (Botafogo)",      // 13
  "Fabinho (Al-Ittihad)",          // 14
  "Lucas Paquetá (Flamengo)",      // 15
  "Éderson (Atalanta)",            // 16
  // Atacantes (idx 17-26)
  "Endrick (Lyon)",                // 17
  "Gabriel Martinelli (Arsenal)",  // 18
  "Igor Thiago (Brentford)",       // 19
  "Luiz Henrique (Zenit)",         // 20
  "Matheus Cunha (Man. United)",   // 21
  "Neymar (Santos)",               // 22
  "Raphinha (Barcelona)",          // 23
  "Rayan (Bournemouth)",           // 24
  "Rodrygo (Real Madrid)",         // 25  
  "Vini Jr. (Real Madrid)",        // 26
];

// Descrição da proposta — usada em propose(), queue(), execute() e no hashProposal().
// Deve ser IDÊNTICA em todos os scripts. Mudar a string = proposalId diferente.
const DESCRICAO =
  "Eleição: Melhor Jogador da Seleção Brasileira — Copa 2026";

module.exports = { NOMES_ONCHAIN, DESCRICAO };
"use strict";

/**
 * @param {string} pattern
 * @param {string} candidate
 * @returns {{ score: number, positions: number[] } | null}
 */
function match(pattern, candidate) {
  if (!pattern) return { score: 0, positions: [] };

  const pLower = pattern.toLowerCase();
  const cLower = candidate.toLowerCase();
  let pIdx = 0;
  let cIdx = 0;

  const positions = [];
  let score = 0;
  let consecutiveCount = 0;

  const sepRegex = /[\\/]/;
  const basenameIdx = Math.max(candidate.lastIndexOf('/'), candidate.lastIndexOf('\\')) + 1;

  while (pIdx < pLower.length && cIdx < cLower.length) {
    if (pLower[pIdx] === cLower[cIdx]) {
      positions.push(cIdx);
      
      // Base score
      score += 10;
      
      // Consecutive bonus
      if (consecutiveCount > 0) {
        score += 15 * consecutiveCount;
      }
      consecutiveCount++;

      // Basename bonus
      if (cIdx >= basenameIdx) {
        score += 5;
      }

      // Start of segment bonus
      if (cIdx === 0 || sepRegex.test(cLower[cIdx - 1]) || (cLower[cIdx - 1] === '-' || cLower[cIdx - 1] === '_')) {
        score += 15;
      }

      pIdx++;
    } else {
      consecutiveCount = 0;
    }
    cIdx++;
  }

  if (pIdx < pLower.length) return null; // Didn't match all characters
  return { score, positions };
}

/**
 * @param {string} pattern
 * @param {string[]} candidates
 * @param {number} [limit=12]
 * @returns {Array<{ value: string, score: number, positions: number[] }>}
 */
function rank(pattern, candidates, limit = 12) {
  const results = [];
  for (const candidate of candidates) {
    const m = match(pattern, candidate);
    if (m) {
      results.push({
        value: candidate,
        score: m.score,
        positions: m.positions
      });
    }
  }
  
  results.sort((a, b) => b.score - a.score || a.value.localeCompare(b.value));
  return results.slice(0, limit);
}

module.exports = {
  match,
  rank
};

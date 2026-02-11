/**
 * Camelot Wheel Compatibility Logic
 * 
 * The Camelot Wheel is a tool used by DJs to identify which songs will mix well together.
 * Keys are represented as numbers 1-12 with letters A (minor) or B (major).
 * 
 * Compatible keys are:
 * 1. Same key (e.g., 8A -> 8A)
 * 2. Adjacent numbers (e.g., 8A -> 7A, 8A -> 9A)
 * 3. Same number, different letter (e.g., 8A -> 8B) - relative major/minor
 */

// Parse Camelot key into number and letter
export function parseCamelotKey(key) {
  if (!key) return null;
  
  const match = key.toUpperCase().match(/^(\d{1,2})([AB])$/);
  if (!match) return null;
  
  return {
    number: parseInt(match[1], 10),
    letter: match[2]
  };
}

// Check if two keys are compatible according to Camelot wheel
export function isKeyCompatible(key1, key2) {
  const parsed1 = parseCamelotKey(key1);
  const parsed2 = parseCamelotKey(key2);
  
  // If either key is missing, we can't determine compatibility
  if (!parsed1 || !parsed2) return false;
  
  const { number: n1, letter: l1 } = parsed1;
  const { number: n2, letter: l2 } = parsed2;
  
  // Same key
  if (n1 === n2 && l1 === l2) return true;
  
  // Same number, different letter (relative major/minor)
  if (n1 === n2 && l1 !== l2) return true;
  
  // Adjacent numbers with same letter (+1 or -1 on the wheel)
  if (l1 === l2) {
    const diff = Math.abs(n1 - n2);
    // Handle wrap-around (12 -> 1, 1 -> 12)
    if (diff === 1 || diff === 11) return true;
  }
  
  return false;
}

// Calculate "compatibility score" for sorting recommendations
export function getCompatibilityScore(sourceKey, targetKey, sourceBpm, targetBpm, bpmTolerance) {
  let score = 0;
  
  // Key compatibility scoring
  const parsed1 = parseCamelotKey(sourceKey);
  const parsed2 = parseCamelotKey(targetKey);
  
  if (parsed1 && parsed2) {
    const { number: n1, letter: l1 } = parsed1;
    const { number: n2, letter: l2 } = parsed2;
    
    // Same key = highest score
    if (n1 === n2 && l1 === l2) {
      score += 100;
    }
    // Relative major/minor
    else if (n1 === n2 && l1 !== l2) {
      score += 80;
    }
    // Adjacent keys
    else if (l1 === l2) {
      const diff = Math.abs(n1 - n2);
      if (diff === 1 || diff === 11) {
        score += 60;
      }
    }
  }
  
  // BPM compatibility scoring
  if (sourceBpm && targetBpm) {
    const bpmDiff = Math.abs(sourceBpm - targetBpm);
    if (bpmDiff <= bpmTolerance) {
      // The closer the BPM, the higher the score
      score += Math.round((1 - bpmDiff / bpmTolerance) * 50);
    }
  }
  
  return score;
}

// Get recommended songs based on compatibility
export function getRecommendations(sourceSong, allSongs, bpmTolerance = 5) {
  if (!sourceSong) return [];
  
  const recommendations = allSongs
    .filter((song) => {
      // Exclude the source song
      if (song.id === sourceSong.id) return false;
      
      // Check BPM compatibility
      const bpmCompatible = !sourceSong.bpm || !song.bpm || 
        Math.abs(sourceSong.bpm - song.bpm) <= bpmTolerance;
      
      // Check key compatibility
      const keyCompatible = isKeyCompatible(sourceSong.key, song.key);
      
      // Song is recommended if it's BPM compatible AND key compatible
      // Or if we don't have enough data to determine
      return bpmCompatible && (keyCompatible || !sourceSong.key || !song.key);
    })
    .map((song) => ({
      ...song,
      compatibilityScore: getCompatibilityScore(
        sourceSong.key, 
        song.key, 
        sourceSong.bpm, 
        song.bpm, 
        bpmTolerance
      )
    }))
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore);
  
  return recommendations;
}

// Get compatibility reason text
export function getCompatibilityReason(sourceKey, targetKey, sourceBpm, targetBpm) {
  const reasons = [];
  
  if (isKeyCompatible(sourceKey, targetKey)) {
    const parsed1 = parseCamelotKey(sourceKey);
    const parsed2 = parseCamelotKey(targetKey);
    
    if (parsed1 && parsed2) {
      if (parsed1.number === parsed2.number && parsed1.letter === parsed2.letter) {
        reasons.push('Same key');
      } else if (parsed1.number === parsed2.number) {
        reasons.push('Relative major/minor');
      } else {
        reasons.push('Adjacent key');
      }
    }
  }
  
  if (sourceBpm && targetBpm) {
    const diff = Math.abs(sourceBpm - targetBpm);
    if (diff <= 3) {
      reasons.push('Very close BPM');
    } else if (diff <= 5) {
      reasons.push('Similar BPM');
    }
  }
  
  return reasons.join(' • ') || 'Compatible';
}

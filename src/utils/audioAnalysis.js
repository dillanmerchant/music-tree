const CAMELOT_MAP = {
  'C': '8B', 'C#': '3B', 'Db': '3B', 'D': '10B', 'D#': '5B', 'Eb': '5B',
  'E': '12B', 'F': '7B', 'F#': '2B', 'Gb': '2B', 'G': '9B',
  'G#': '4B', 'Ab': '4B', 'A': '11B', 'A#': '6B', 'Bb': '6B', 'B': '1B',
  'Cm': '5A', 'C#m': '12A', 'Dbm': '12A', 'Dm': '7A', 'D#m': '2A', 'Ebm': '2A',
  'Em': '9A', 'Fm': '4A', 'F#m': '11A', 'Gbm': '11A', 'Gm': '6A',
  'G#m': '1A', 'Abm': '1A', 'Am': '8A', 'A#m': '3A', 'Bbm': '3A', 'Bm': '10A'
};

const KEY_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

function convertToCamelot(musicalKey) {
  if (!musicalKey) return null;
  if (/^(1[0-2]|[1-9])[AB]$/i.test(musicalKey)) return musicalKey.toUpperCase();
  const normalized = musicalKey.trim().replace(/\s+/g, '').replace('min', 'm').replace('maj', '');
  return CAMELOT_MAP[normalized] || musicalKey;
}

function pearsonCorrelation(x, y) {
  const n = x.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0, sumY2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += x[i]; sumY += y[i];
    sumXY += x[i] * y[i];
    sumX2 += x[i] * x[i]; sumY2 += y[i] * y[i];
  }
  const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
  return denom === 0 ? 0 : (n * sumXY - sumX * sumY) / denom;
}

// Goertzel algorithm: O(N) magnitude at a single frequency
function goertzel(samples, targetFreq, sampleRate) {
  const N = samples.length;
  const k = Math.round(N * targetFreq / sampleRate);
  const w = 2 * Math.PI * k / N;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

// Build list of note frequencies for chromagram (C1 to B6)
function getNoteFrequencies() {
  const notes = [];
  for (let octave = 1; octave <= 6; octave++) {
    for (let pc = 0; pc < 12; pc++) {
      const midi = 12 * (octave + 1) + pc;
      const freq = 440 * Math.pow(2, (midi - 69) / 12);
      if (freq >= 32 && freq <= 4000) {
        notes.push({ pitchClass: pc, freq });
      }
    }
  }
  return notes;
}

const NOTE_FREQUENCIES = getNoteFrequencies();

function detectKey(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const raw = audioBuffer.getChannelData(0);

  // Analyze up to 30 seconds from the middle of the track
  const maxSamples = Math.min(raw.length, sampleRate * 30);
  const startOffset = Math.max(0, Math.floor((raw.length - maxSamples) / 2));
  const samples = raw.slice(startOffset, startOffset + maxSamples);

  // Downsample to ~11025 Hz for faster analysis
  const dsRate = 4;
  const dsSampleRate = sampleRate / dsRate;
  const downsampled = new Float32Array(Math.floor(samples.length / dsRate));
  for (let i = 0; i < downsampled.length; i++) {
    downsampled[i] = samples[i * dsRate];
  }

  // Compute chromagram via Goertzel over frames
  const frameSize = 2048;
  const hopSize = 1024;
  const chromagram = new Float64Array(12);
  const relevantNotes = NOTE_FREQUENCIES.filter(n => n.freq < dsSampleRate / 2);
  let frameCount = 0;

  for (let offset = 0; offset + frameSize <= downsampled.length; offset += hopSize) {
    const frame = downsampled.slice(offset, offset + frameSize);
    // Hann window
    for (let i = 0; i < frameSize; i++) {
      frame[i] *= 0.5 - 0.5 * Math.cos(2 * Math.PI * i / frameSize);
    }
    for (const { pitchClass, freq } of relevantNotes) {
      chromagram[pitchClass] += goertzel(frame, freq, dsSampleRate);
    }
    frameCount++;
  }

  if (frameCount === 0) return null;

  // Normalize
  const maxVal = Math.max(...chromagram);
  if (maxVal === 0) return null;
  const normalized = Array.from(chromagram).map(v => v / maxVal);

  // Correlate with key profiles
  let bestKey = 'C';
  let bestCorr = -Infinity;
  for (let i = 0; i < 12; i++) {
    const rotated = [];
    for (let j = 0; j < 12; j++) rotated.push(normalized[(j + i) % 12]);

    const majorCorr = pearsonCorrelation(rotated, MAJOR_PROFILE);
    if (majorCorr > bestCorr) { bestCorr = majorCorr; bestKey = KEY_NAMES[i]; }

    const minorCorr = pearsonCorrelation(rotated, MINOR_PROFILE);
    if (minorCorr > bestCorr) { bestCorr = minorCorr; bestKey = KEY_NAMES[i] + 'm'; }
  }

  return convertToCamelot(bestKey);
}

function detectBPM(audioBuffer) {
  const sampleRate = audioBuffer.sampleRate;
  const raw = audioBuffer.getChannelData(0);

  if (raw.length < sampleRate * 5) return null; // need at least 5 seconds

  // Downsample via averaging groups → effective rate ~220 Hz
  const groupSize = Math.round(sampleRate / 220);
  const dsLength = Math.floor(raw.length / groupSize);
  const downsampled = new Float32Array(dsLength);
  for (let i = 0; i < dsLength; i++) {
    let sum = 0;
    const base = i * groupSize;
    for (let j = 0; j < groupSize; j++) sum += Math.abs(raw[base + j]);
    downsampled[i] = sum / groupSize;
  }
  const dsRate = sampleRate / groupSize;

  // Onset strength: positive first-difference
  const onset = new Float32Array(dsLength - 1);
  for (let i = 1; i < dsLength; i++) {
    onset[i - 1] = Math.max(0, downsampled[i] - downsampled[i - 1]);
  }

  // Autocorrelation for BPM 60-200
  const minLag = Math.round(60 / 200 * dsRate);
  const maxLag = Math.min(Math.round(60 / 60 * dsRate), Math.floor(onset.length / 2));

  let bestCorr = -1;
  let bestLag = 0;

  for (let lag = minLag; lag <= maxLag; lag++) {
    let corr = 0;
    const count = onset.length - lag;
    for (let i = 0; i < count; i++) corr += onset[i] * onset[i + lag];
    corr /= count;
    if (corr > bestCorr) { bestCorr = corr; bestLag = lag; }
  }

  if (bestLag === 0) return null;
  let bpm = 60 / (bestLag / dsRate);

  // Prefer typical DJ range: 70-180
  while (bpm > 180) bpm /= 2;
  while (bpm < 70) bpm *= 2;

  return Math.round(bpm);
}

export async function analyzeAudio(audioUrl) {
  try {
    console.log('[AudioAnalysis] Starting analysis, fetching:', audioUrl.slice(0, 80));
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch(audioUrl);
    if (!response.ok) throw new Error(`Fetch failed: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    console.log('[AudioAnalysis] Fetched', arrayBuffer.byteLength, 'bytes, decoding...');
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    console.log('[AudioAnalysis] Decoded: duration=', audioBuffer.duration.toFixed(1), 's, sampleRate=', audioBuffer.sampleRate, ', channels=', audioBuffer.numberOfChannels);

    const bpm = detectBPM(audioBuffer);
    console.log('[AudioAnalysis] BPM detected:', bpm);
    const key = detectKey(audioBuffer);
    console.log('[AudioAnalysis] Key detected:', key);

    audioContext.close().catch(() => {});
    return { bpm, key };
  } catch (error) {
    console.error('[AudioAnalysis] Analysis error:', error);
    return { bpm: null, key: null };
  }
}

export async function analyzeAndUpdateSong(song) {
  if (song.bpm && song.key) {
    console.log('[AudioAnalysis] Skipping (already has BPM & key):', song.title);
    return null;
  }

  console.log('[AudioAnalysis] Analyzing song:', song.title, '| missing:', !song.bpm ? 'BPM' : '', !song.key ? 'Key' : '');
  try {
    const urlRes = await window.api.getAudioUrl(song.filePath);
    if (!urlRes.success || !urlRes.data) {
      console.error('[AudioAnalysis] getAudioUrl failed for:', song.title, urlRes.error);
      return null;
    }

    const { bpm, key } = await analyzeAudio(urlRes.data);
    const updates = {};
    if (!song.bpm && bpm) updates.bpm = bpm;
    if (!song.key && key) updates.key = key;

    if (Object.keys(updates).length > 0) {
      console.log('[AudioAnalysis] Saving updates for', song.title, ':', updates);
      await window.api.updateSong(song.id, updates);
      return updates;
    }
    console.log('[AudioAnalysis] No new data detected for:', song.title);
  } catch (err) {
    console.error('[AudioAnalysis] Failed for:', song.title, err);
  }
  return null;
}

// Force re-analysis: ignores existing bpm/key values
export async function forceAnalyzeSong(song) {
  console.log('[AudioAnalysis] Force re-analyzing:', song.title);
  try {
    const urlRes = await window.api.getAudioUrl(song.filePath);
    if (!urlRes.success || !urlRes.data) {
      console.error('[AudioAnalysis] getAudioUrl failed for:', song.title, urlRes.error);
      return null;
    }

    const { bpm, key } = await analyzeAudio(urlRes.data);
    const updates = {};
    if (bpm) updates.bpm = bpm;
    if (key) updates.key = key;

    if (Object.keys(updates).length > 0) {
      console.log('[AudioAnalysis] Saving re-analysis for', song.title, ':', updates);
      await window.api.updateSong(song.id, updates);
      return updates;
    }
    console.log('[AudioAnalysis] Re-analysis produced no data for:', song.title);
  } catch (err) {
    console.error('[AudioAnalysis] Force re-analysis failed for:', song.title, err);
  }
  return null;
}

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const PUBLIC_DIR = path.resolve('public');
if (!fs.existsSync(PUBLIC_DIR)) {
  fs.mkdirSync(PUBLIC_DIR, { recursive: true });
}

// Generate 16-bit PCM WAV in Node.js
function generateWav(filename, durationSec, sampleFn) {
  const sampleRate = 44100;
  const numChannels = 2;
  const bytesPerSample = 2;
  const totalSamples = Math.floor(sampleRate * durationSec);
  const dataSize = totalSamples * numChannels * bytesPerSample;
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  
  // fmt subchunk
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1size (16 for PCM)
  buffer.writeUInt16LE(1, 20);  // audioFormat (1 = PCM)
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); // byteRate
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32); // blockAlign
  buffer.writeUInt16LE(bytesPerSample * 8, 34); // bitsPerSample
  
  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = sampleFn(t, i, sampleRate);
    
    // Clamp to -1.0 .. 1.0
    const clampL = Math.max(-1, Math.min(1, left));
    const clampR = Math.max(-1, Math.min(1, right));
    
    const sampleIntL = Math.floor(clampL * 32767);
    const sampleIntR = Math.floor(clampR * 32767);
    
    buffer.writeInt16LE(sampleIntL, offset);
    buffer.writeInt16LE(sampleIntR, offset + 2);
    offset += 4;
  }
  
  fs.writeFileSync(filename, buffer);
  console.log(`Generated WAV: ${filename} (${(buffer.length / (1024 * 1024)).toFixed(2)} MB)`);
}

// 1. Nature Audio: Forest stream + melodic bird calls + wind
function natureAudio(t) {
  // Gentle river white/pink noise modulated
  const river = (Math.random() * 2 - 1) * 0.12 * (1 + 0.2 * Math.sin(t * 0.8));
  // Wind breeze low frequency
  const wind = Math.sin(2 * Math.PI * 45 * t) * 0.08 * (Math.sin(t * 0.3) * 0.5 + 0.5);
  
  // Bird chirps at intervals
  const chirpTime = t % 3.5;
  let chirp = 0;
  if (chirpTime > 0.5 && chirpTime < 1.2) {
    const subT = chirpTime - 0.5;
    const freq = 2200 + Math.sin(subT * 25) * 800 + Math.sin(subT * 60) * 300;
    chirp = Math.sin(2 * Math.PI * freq * t) * 0.18 * Math.sin((subT / 0.7) * Math.PI);
  }
  
  const left = river * 0.8 + wind + chirp * 0.9;
  const right = river * 0.9 + wind + chirp * 0.6;
  return [left, right];
}

// 2. Cyberpunk Audio: 80s Synthwave Bassline + Neon Arp + Electro Kick
function cyberpunkAudio(t) {
  const bpm = 120;
  const beat = (t * (bpm / 60)) % 4;
  
  // Kick drum on beats 0, 1, 2, 3
  const kickTime = beat % 1;
  const kick = kickTime < 0.2 ? Math.sin(2 * Math.PI * (120 - kickTime * 400) * kickTime) * Math.exp(-kickTime * 15) * 0.6 : 0;
  
  // Bassline notes (A1, F1, G1, E1)
  const bassNotes = [55, 43.65, 49, 41.2];
  const bar = Math.floor((t * (bpm / 60)) / 4) % bassNotes.length;
  const bassFreq = bassNotes[bar];
  const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.4 * Math.sin(2 * Math.PI * bassFreq * 2 * t)) * 0.35;
  
  // Synth arpeggio (16th notes)
  const step = Math.floor(t * (bpm / 60) * 4) % 8;
  const arpFreqs = [220, 261.63, 329.63, 440, 523.25, 440, 329.63, 261.63];
  const arpFreq = arpFreqs[step];
  const arpTime = (t * (bpm / 60) * 4) % 1;
  const arp = (Math.sin(2 * Math.PI * arpFreq * t) + 0.3 * Math.sin(2 * Math.PI * arpFreq * 3 * t)) * Math.exp(-arpTime * 6) * 0.25;
  
  const left = kick * 0.7 + bass * 0.8 + arp * 0.9;
  const right = kick * 0.7 + bass * 0.8 + arp * 0.6;
  return [left, right];
}

// 3. Lo-Fi Hip Hop Audio: Warm electric piano chords + vinyl crackle + relaxed groove
function lofiAudio(t) {
  const bpm = 75;
  const barTime = (t * (bpm / 60) / 4) % 4;
  
  // Chords: Cmaj7, Am7, Dm7, G7
  const chordMap = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [146.83, 174.61, 220.00, 261.63], // Dm7
    [196.00, 246.94, 293.66, 349.23]  // G7
  ];
  const chord = chordMap[Math.floor(barTime)];
  
  let piano = 0;
  for (const f of chord) {
    piano += Math.sin(2 * Math.PI * f * t) + 0.2 * Math.sin(2 * Math.PI * f * 2 * t);
  }
  piano = piano * 0.08 * (0.8 + 0.2 * Math.sin(t * 1.5));
  
  // Gentle vinyl crackle
  const crackle = (Math.random() > 0.992 ? (Math.random() * 2 - 1) * 0.2 : 0) + (Math.random() * 2 - 1) * 0.015;
  
  // Soft kick and snare
  const beat = (t * (bpm / 60)) % 2;
  const kick = (beat < 0.15) ? Math.sin(2 * Math.PI * (80 - beat * 200) * beat) * 0.4 : 0;
  const snare = (beat > 0.95 && beat < 1.15) ? (Math.random() * 2 - 1) * 0.15 * Math.exp(-(beat - 0.95) * 15) : 0;
  
  const left = piano * 0.9 + crackle + kick * 0.6 + snare * 0.5;
  const right = piano * 0.7 + crackle + kick * 0.6 + snare * 0.7;
  return [left, right];
}

// 4. Space Audio: Ambient celestial choral pad + sub drone
function spaceAudio(t) {
  // Deep sub drone
  const drone = (Math.sin(2 * Math.PI * 55 * t) + 0.5 * Math.sin(2 * Math.PI * 110 * t)) * 0.25;
  
  // Shimmering celestial pad
  const padFrequencies = [220, 277.18, 329.63, 440, 554.37];
  let pad = 0;
  padFrequencies.forEach((f, idx) => {
    const lfo = Math.sin(t * (0.2 + idx * 0.05)) * 0.5 + 0.5;
    pad += Math.sin(2 * Math.PI * f * t) * lfo * 0.06;
  });
  
  // Cosmic sweep
  const sweepFreq = 600 + Math.sin(t * 0.15) * 400;
  const sweep = Math.sin(2 * Math.PI * sweepFreq * t) * 0.04;
  
  const left = drone * 0.8 + pad * 0.9 + sweep;
  const right = drone * 0.8 + pad * 0.7 - sweep * 0.5;
  return [left, right];
}

async function main() {
  console.log('Generating distinct high-definition audio tracks...');
  const duration = 25; // 25 seconds loopable
  
  generateWav('/tmp/audio_nature.wav', duration, natureAudio);
  generateWav('/tmp/audio_cyberpunk.wav', duration, cyberpunkAudio);
  generateWav('/tmp/audio_lofi.wav', duration, lofiAudio);
  generateWav('/tmp/audio_space.wav', duration, spaceAudio);

  // Generate pure MP3 exports
  console.log('Encoding standalone MP3 audio masters...');
  execSync('ffmpeg -y -i /tmp/audio_nature.wav -codec:a libmp3lame -b:a 320k public/sample-nature.mp3');
  execSync('ffmpeg -y -i /tmp/audio_cyberpunk.wav -codec:a libmp3lame -b:a 320k public/sample-cyberpunk.mp3');
  execSync('ffmpeg -y -i /tmp/audio_lofi.wav -codec:a libmp3lame -b:a 320k public/sample-lofi.mp3');
  execSync('ffmpeg -y -i /tmp/audio_space.wav -codec:a libmp3lame -b:a 320k public/sample-space.mp3');

  // Video 1: Costa Rica Nature 4K & 1080p (Green forest theme + sound)
  console.log('Rendering Nature 4K and 1080p MP4...');
  execSync(`ffmpeg -y -f lavfi -i "color=c=0x062817:s=1920x1080:r=30:d=${duration}" -i /tmp/audio_nature.wav -vf "drawtext=text='COSTA RICA 4K HDR · CANOPY WILDLIFE':fontcolor=white:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2-40,drawtext=text='Ultra HD 60FPS · Ambient Rainforest & River Sound':fontcolor=0x4ade80:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+40" -c:v libx264 -pix_fmt yuv420p -b:v 8M -c:a aac -b:a 256k public/sample-nature.mp4`);

  // Video 2: Cyberpunk Night City (Neon Cyan/Magenta theme + Synthwave sound)
  console.log('Rendering Cyberpunk 60fps MP4...');
  execSync(`ffmpeg -y -f lavfi -i "color=c=0x15002b:s=1920x1080:r=60:d=${duration}" -i /tmp/audio_cyberpunk.wav -vf "drawtext=text='CYBERPUNK 2077 · NIGHT CITY 60FPS':fontcolor=0x06b6d4:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2-40,drawtext=text='Path Tracing Overdrive · 80s Synthwave Bassline':fontcolor=0xf43f5e:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+40" -c:v libx264 -pix_fmt yuv420p -b:v 12M -c:a aac -b:a 320k public/sample-cyberpunk.mp4`);

  // Video 3: Lo-Fi Hip Hop Chill Beats (Warm Amber theme + Lo-Fi Beats sound)
  console.log('Rendering Lo-Fi Chill Beats MP4...');
  execSync(`ffmpeg -y -f lavfi -i "color=c=0x2b1300:s=1920x1080:r=30:d=${duration}" -i /tmp/audio_lofi.wav -vf "drawtext=text='LOFI HIP HOP RADIO · CHILL BEATS':fontcolor=0xfbbf24:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2-40,drawtext=text='Warm Rhodes Piano & Vinyl Crackle · Study / Relax':fontcolor=0xfef08a:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+40" -c:v libx264 -pix_fmt yuv420p -b:v 6M -c:a aac -b:a 320k public/sample-lofi.mp4`);

  // Video 4: Deep Space Cosmos (Deep Cosmic Blue/Violet + Space Choir sound)
  console.log('Rendering Deep Space JWST MP4...');
  execSync(`ffmpeg -y -f lavfi -i "color=c=0x030318:s=1920x1080:r=30:d=${duration}" -i /tmp/audio_space.wav -vf "drawtext=text='DEEP SPACE · JWST NEBULA EXPEDITION 4K':fontcolor=0xa855f7:fontsize=52:x=(w-text_w)/2:y=(h-text_h)/2-40,drawtext=text='Carina Stellar Nurseries · Celestial Ambient Sound':fontcolor=0xe9d5ff:fontsize=30:x=(w-text_w)/2:y=(h-text_h)/2+40" -c:v libx264 -pix_fmt yuv420p -b:v 10M -c:a aac -b:a 256k public/sample-space.mp4`);

  // Also create generic fallback
  execSync('cp public/sample-nature.mp4 public/sample-video.mp4');

  console.log('All 4 media files rendered successfully with genuine stereo audio!');
}

main().catch(console.error);

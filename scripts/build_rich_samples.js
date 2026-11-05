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
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28);
  buffer.writeUInt16LE(numChannels * bytesPerSample, 32);
  buffer.writeUInt16LE(bytesPerSample * 8, 34);
  
  // data subchunk
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  let offset = 44;
  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    const [left, right] = sampleFn(t, i, sampleRate);
    
    const clampL = Math.max(-1, Math.min(1, left));
    const clampR = Math.max(-1, Math.min(1, right));
    
    const sampleIntL = Math.floor(clampL * 32767);
    const sampleIntR = Math.floor(clampR * 32767);
    
    buffer.writeInt16LE(sampleIntL, offset);
    buffer.writeInt16LE(sampleIntR, offset + 2);
    offset += 4;
  }
  
  fs.writeFileSync(filename, buffer);
  console.log(`Generated WAV: ${filename}`);
}

// 1. Nature Audio: Forest stream + melodic bird calls + wind
function natureAudio(t) {
  const river = (Math.random() * 2 - 1) * 0.14 * (1 + 0.25 * Math.sin(t * 0.8));
  const wind = Math.sin(2 * Math.PI * 50 * t) * 0.1 * (Math.sin(t * 0.3) * 0.5 + 0.5);
  
  const chirpTime = t % 2.8;
  let chirp = 0;
  if (chirpTime > 0.4 && chirpTime < 1.3) {
    const subT = chirpTime - 0.4;
    const freq = 2400 + Math.sin(subT * 28) * 900 + Math.sin(subT * 65) * 400;
    chirp = Math.sin(2 * Math.PI * freq * t) * 0.35 * Math.sin((subT / 0.9) * Math.PI);
  }
  
  const left = river * 0.7 + wind + chirp * 0.95;
  const right = river * 0.8 + wind + chirp * 0.7;
  return [left, right];
}

// 2. Cyberpunk Audio: 120BPM Electro Kick, Synth Bass, Neon Arpeggios
function cyberpunkAudio(t) {
  const bpm = 120;
  const beat = (t * (bpm / 60)) % 4;
  
  const kickTime = beat % 1;
  const kick = kickTime < 0.22 ? Math.sin(2 * Math.PI * (140 - kickTime * 450) * kickTime) * Math.exp(-kickTime * 14) * 0.7 : 0;
  
  const bassNotes = [55, 43.65, 49, 41.2];
  const bar = Math.floor((t * (bpm / 60)) / 4) % bassNotes.length;
  const bassFreq = bassNotes[bar];
  const bass = (Math.sin(2 * Math.PI * bassFreq * t) + 0.45 * Math.sin(2 * Math.PI * bassFreq * 2 * t)) * 0.45;
  
  const step = Math.floor(t * (bpm / 60) * 4) % 8;
  const arpFreqs = [220, 261.63, 329.63, 440, 523.25, 440, 329.63, 261.63];
  const arpFreq = arpFreqs[step];
  const arpTime = (t * (bpm / 60) * 4) % 1;
  const arp = (Math.sin(2 * Math.PI * arpFreq * t) + 0.35 * Math.sin(2 * Math.PI * arpFreq * 3 * t)) * Math.exp(-arpTime * 5.5) * 0.35;
  
  const left = kick * 0.8 + bass * 0.85 + arp * 0.9;
  const right = kick * 0.8 + bass * 0.85 + arp * 0.65;
  return [left, right];
}

// 3. Lo-Fi Hip Hop Audio: Warm electric piano chords + vinyl crackle + relaxed groove
function lofiAudio(t) {
  const bpm = 75;
  const barTime = (t * (bpm / 60) / 4) % 4;
  
  const chordMap = [
    [261.63, 329.63, 392.00, 493.88], // Cmaj7
    [220.00, 261.63, 329.63, 392.00], // Am7
    [146.83, 174.61, 220.00, 261.63], // Dm7
    [196.00, 246.94, 293.66, 349.23]  // G7
  ];
  const chord = chordMap[Math.floor(barTime)];
  
  let piano = 0;
  for (const f of chord) {
    piano += Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * f * 2 * t);
  }
  piano = piano * 0.12 * (0.8 + 0.2 * Math.sin(t * 1.5));
  
  const crackle = (Math.random() > 0.99 ? (Math.random() * 2 - 1) * 0.22 : 0) + (Math.random() * 2 - 1) * 0.02;
  const beat = (t * (bpm / 60)) % 2;
  const kick = (beat < 0.18) ? Math.sin(2 * Math.PI * (90 - beat * 220) * beat) * 0.5 : 0;
  const snare = (beat > 0.95 && beat < 1.18) ? (Math.random() * 2 - 1) * 0.22 * Math.exp(-(beat - 0.95) * 14) : 0;
  
  const left = piano * 0.9 + crackle + kick * 0.7 + snare * 0.6;
  const right = piano * 0.8 + crackle + kick * 0.7 + snare * 0.8;
  return [left, right];
}

// 4. Space Audio: Deep sub drone + celestial pad + cosmic sweep
function spaceAudio(t) {
  const drone = (Math.sin(2 * Math.PI * 55 * t) + 0.5 * Math.sin(2 * Math.PI * 110 * t)) * 0.35;
  const padFrequencies = [220, 277.18, 329.63, 440, 554.37];
  let pad = 0;
  padFrequencies.forEach((f, idx) => {
    const lfo = Math.sin(t * (0.2 + idx * 0.05)) * 0.5 + 0.5;
    pad += Math.sin(2 * Math.PI * f * t) * lfo * 0.09;
  });
  
  const sweepFreq = 600 + Math.sin(t * 0.15) * 400;
  const sweep = Math.sin(2 * Math.PI * sweepFreq * t) * 0.06;
  
  const left = drone * 0.85 + pad * 0.9 + sweep;
  const right = drone * 0.85 + pad * 0.75 - sweep * 0.6;
  return [left, right];
}

async function main() {
  const duration = 20; // 20s high quality loop
  console.log('1. Generating audio WAVs...');
  generateWav('/tmp/audio_nature.wav', duration, natureAudio);
  generateWav('/tmp/audio_cyberpunk.wav', duration, cyberpunkAudio);
  generateWav('/tmp/audio_lofi.wav', duration, lofiAudio);
  generateWav('/tmp/audio_space.wav', duration, spaceAudio);

  console.log('2. Generating 320kbps MP3s...');
  execSync('ffmpeg -y -i /tmp/audio_nature.wav -codec:a libmp3lame -b:a 320k public/sample-nature.mp3');
  execSync('ffmpeg -y -i /tmp/audio_cyberpunk.wav -codec:a libmp3lame -b:a 320k public/sample-cyberpunk.mp3');
  execSync('ffmpeg -y -i /tmp/audio_lofi.wav -codec:a libmp3lame -b:a 320k public/sample-lofi.mp3');
  execSync('ffmpeg -y -i /tmp/audio_space.wav -codec:a libmp3lame -b:a 320k public/sample-space.mp3');

  console.log('3. Rendering 4 distinct, animated, high-definition videos...');

  // Sample 1: Costa Rica Nature - Lush green animated test pattern with birds & rainforest sounds
  console.log('Rendering Nature (Costa Rica)...');
  execSync(`ffmpeg -y -f lavfi -i "testsrc2=s=1920x1080:r=30:d=${duration}" -i /tmp/audio_nature.wav -vf "colorbalance=gs=0.5:gm=0.3:rs=-0.2:bs=-0.3,drawtext=text='COSTA RICA 4K 60FPS HDR · NATURE':fontcolor=white:fontsize=50:x=(w-text_w)/2:y=100:box=1:boxcolor=0x062817cc:boxborderw=14,drawtext=text='CANOPY RAINFOREST & WATERFALL AUDIO · 10-BIT COLOR':fontcolor=0x86efac:fontsize=28:x=(w-text_w)/2:y=175:box=1:boxcolor=0x062817cc:boxborderw=8" -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 8M -c:a aac -b:a 256k public/sample-nature.mp4`);

  // Sample 2: Cyberpunk 2077 Night City - Neon Magenta / Cyan 60fps high frame-rate animation
  console.log('Rendering Cyberpunk 60fps...');
  execSync(`ffmpeg -y -f lavfi -i "testsrc2=s=1920x1080:r=60:d=${duration}" -i /tmp/audio_cyberpunk.wav -vf "colorbalance=rs=0.4:bs=0.6:gs=-0.2,drawtext=text='CYBERPUNK 2077 · NIGHT CITY 60FPS':fontcolor=0x67e8f9:fontsize=50:x=(w-text_w)/2:y=100:box=1:boxcolor=0x15002bcc:boxborderw=14,drawtext=text='PATH TRACING OVERDRIVE · 120BPM SYNTHWAVE MASTER':fontcolor=0xf43f5e:fontsize=28:x=(w-text_w)/2:y=175:box=1:boxcolor=0x15002bcc:boxborderw=8" -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 10M -c:a aac -b:a 320k public/sample-cyberpunk.mp4`);

  // Sample 3: Lo-Fi Chill Beats - Warm Amber / Sepia vintage animation
  console.log('Rendering Lo-Fi Chill Beats...');
  execSync(`ffmpeg -y -f lavfi -i "testsrc2=s=1920x1080:r=30:d=${duration}" -i /tmp/audio_lofi.wav -vf "colorbalance=rs=0.5:gs=0.25:bs=-0.4,drawtext=text='LOFI HIP HOP RADIO · CHILL BEATS':fontcolor=0xfef08a:fontsize=50:x=(w-text_w)/2:y=100:box=1:boxcolor=0x2b1300cc:boxborderw=14,drawtext=text='WARM RHODES PIANO & VINYL GROOVE · 320KBPS MP3':fontcolor=0xfde047:fontsize=28:x=(w-text_w)/2:y=175:box=1:boxcolor=0x2b1300cc:boxborderw=8" -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 6M -c:a aac -b:a 320k public/sample-lofi.mp4`);

  // Sample 4: Deep Space JWST - Violet / Cosmic Blue stellar expedition
  console.log('Rendering Deep Space JWST...');
  execSync(`ffmpeg -y -f lavfi -i "testsrc2=s=1920x1080:r=30:d=${duration}" -i /tmp/audio_space.wav -vf "colorbalance=rs=0.1:gs=-0.2:bs=0.6,drawtext=text='DEEP SPACE · JWST NEBULA EXPEDITION 4K':fontcolor=0xd8b4fe:fontsize=50:x=(w-text_w)/2:y=100:box=1:boxcolor=0x0a0520cc:boxborderw=14,drawtext=text='CARINA STELLAR NURSERIES · CELESTIAL SUB DRONE':fontcolor=0xc084fc:fontsize=28:x=(w-text_w)/2:y=175:box=1:boxcolor=0x0a0520cc:boxborderw=8" -c:v libx264 -preset veryfast -pix_fmt yuv420p -b:v 8M -c:a aac -b:a 256k public/sample-space.mp4`);

  // Fallback
  execSync('cp public/sample-nature.mp4 public/sample-video.mp4');

  console.log('All 4 media samples re-rendered with active animated visuals and high-bitrate stereo sound!');
}

main().catch(console.error);

// Isla Fortuna — audio.js
// WebAudio synth effects + a tiny procedural music loop (bass line + sparse lead). No audio files,
// no network. Everything is guarded so headless browsers never throw.

export function createAudio() {
  const audio = {
    ctx: null, master: null, musicGain: null, muted: false, musicTimer: 0,
    musicStep: 0, engineOsc: null, engineGain: null,
    ensure() {
      if (audio.ctx) return true;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        audio.ctx = new AC();
        audio.master = audio.ctx.createGain();
        audio.master.gain.value = audio.muted ? 0 : 0.5;
        audio.master.connect(audio.ctx.destination);
        audio.musicGain = audio.ctx.createGain();
        audio.musicGain.gain.value = 0.16;
        audio.musicGain.connect(audio.master);
      } catch (e) { return false; }
      return true;
    },
    resume() { if (audio.ensure() && audio.ctx.state === 'suspended') audio.ctx.resume().catch(() => {}); },
    setMuted(m) {
      audio.muted = m;
      if (audio.master && audio.ctx) audio.master.gain.value = m ? 0 : 0.5;
    },
    tone(freq, dur, type = 'sine', vol = 0.3, slideTo = 0) {
      if (!audio.ensure() || audio.muted) return;
      try {
        const t = audio.ctx.currentTime;
        const o = audio.ctx.createOscillator();
        const g = audio.ctx.createGain();
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g); g.connect(audio.master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) { /* ignore */ }
    },
    noise(dur, vol = 0.2, lowpass = 1200) {
      if (!audio.ensure() || audio.muted) return;
      try {
        const t = audio.ctx.currentTime;
        const len = Math.floor(audio.ctx.sampleRate * dur);
        const buf = audio.ctx.createBuffer(1, len, audio.ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        const src = audio.ctx.createBufferSource(); src.buffer = buf;
        const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass;
        const g = audio.ctx.createGain(); g.gain.value = vol;
        src.connect(f); f.connect(g); g.connect(audio.master);
        src.start(t);
      } catch (e) { /* ignore */ }
    },
    // Named game sounds.
    click() { audio.tone(660, 0.06, 'square', 0.15); },
    pickup() { audio.tone(520, 0.09, 'sine', 0.3); audio.tone(780, 0.12, 'sine', 0.25); },
    coin() { audio.tone(990, 0.08, 'square', 0.2); setTimeout(() => audio.tone(1320, 0.14, 'square', 0.2), 70); },
    punch() { audio.noise(0.12, 0.35, 900); audio.tone(140, 0.1, 'triangle', 0.3, 60); },
    horn() { audio.tone(370, 0.28, 'sawtooth', 0.22); audio.tone(466, 0.28, 'sawtooth', 0.18); },
    crash() { audio.noise(0.25, 0.4, 500); },
    sirenBlip() { audio.tone(880, 0.15, 'square', 0.1, 660); },
    success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => audio.tone(f, 0.16, 'triangle', 0.28), i * 90)); },
    fail() { [400, 320, 240].forEach((f, i) => setTimeout(() => audio.tone(f, 0.2, 'sawtooth', 0.2), i * 120)); },
    busted() { audio.tone(220, 0.5, 'sawtooth', 0.25, 110); },
    // Engine hum follows speed (0..1).
    engine(level) {
      if (!audio.ensure() || audio.muted) return;
      try {
        if (!audio.engineOsc) {
          audio.engineOsc = audio.ctx.createOscillator();
          audio.engineOsc.type = 'sawtooth';
          audio.engineGain = audio.ctx.createGain();
          audio.engineGain.gain.value = 0;
          const f = audio.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 400;
          audio.engineOsc.connect(f); f.connect(audio.engineGain); audio.engineGain.connect(audio.master);
          audio.engineOsc.start();
        }
        audio.engineOsc.frequency.value = 50 + level * 140;
        audio.engineGain.gain.value = level > 0.02 ? 0.05 + level * 0.05 : 0;
      } catch (e) { /* ignore */ }
    },
    // Simple island groove: bass line + sparse lead, stepped by the game loop.
    musicTick(dt) {
      if (!audio.ctx || audio.muted) return;
      audio.musicTimer += dt;
      if (audio.musicTimer < 0.24) return;
      audio.musicTimer = 0;
      const bass = [110, 0, 130.8, 0, 98, 0, 146.8, 0, 110, 0, 130.8, 164.8, 98, 0, 123.5, 0];
      const lead = [440, 0, 523, 587, 0, 659, 0, 523, 440, 0, 392, 0, 523, 0, 587, 659];
      const i = audio.musicStep % 16; audio.musicStep++;
      if (bass[i]) audio.tone(bass[i], 0.22, 'triangle', 0.5);
      if (lead[i] && audio.musicStep % 2 === 0) audio.tone(lead[i], 0.2, 'sine', 0.12);
    },
  };
  return audio;
}

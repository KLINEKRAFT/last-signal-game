// A small procedural soundscape. No downloads; audio starts only on a user gesture.
export function createSoundscape() {
  let context,
    master,
    windGain,
    fireGain,
    enabled = false;
  function start() {
    if (context) return true;
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return false;
    context = new Audio();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);
    const buffer = context.createBuffer(
        1,
        context.sampleRate * 3,
        context.sampleRate,
      ),
      data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = (last + (Math.random() * 2 - 1) * 0.025) / 1.025;
      data[i] = last * 7;
    }
    const wind = context.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    const low = context.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.value = 480;
    windGain = context.createGain();
    windGain.gain.value = 0.17;
    wind.connect(low).connect(windGain).connect(master);
    wind.start();
    const fire = context.createBufferSource();
    fire.buffer = buffer;
    fire.loop = true;
    fire.playbackRate.value = 1.7;
    const high = context.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 1200;
    fireGain = context.createGain();
    fireGain.gain.value = 0;
    fire.connect(high).connect(fireGain).connect(master);
    fire.start();
    return true;
  }
  function setEnabled(value) {
    if (value && !start()) return false;
    enabled = value;
    if (context) {
      context.resume().catch(() => {});
      master.gain.setTargetAtTime(value ? 0.8 : 0, context.currentTime, 0.3);
    }
    return enabled;
  }
  function tone(frequency, duration = 0.15, volume = 0.08) {
    if (!enabled || !context || context.state !== "running") return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0, context.currentTime);
    gain.gain.linearRampToValueAtTime(volume, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(
      0.001,
      context.currentTime + duration,
    );
    oscillator.connect(gain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + duration + 0.01);
  }
  function update({ distanceToFire, burning, paused }) {
    if (!context) return;
    const now = context.currentTime;
    master.gain.setTargetAtTime(enabled && !paused ? 0.8 : 0, now, 0.3);
    fireGain.gain.setTargetAtTime(
      burning ? Math.max(0, 1 - distanceToFire / 8) * 0.12 : 0,
      now,
      0.25,
    );
    windGain.gain.setTargetAtTime(
      0.13 + Math.min(20, distanceToFire) * 0.002,
      now,
      1,
    );
  }
  return {
    setEnabled,
    update,
    step: () => tone(110 + Math.random() * 40, 0.075, 0.025),
    collect: () => tone(530, 0.12, 0.045),
    signal: () => {
      tone(660, 0.7, 0.06);
      setTimeout(() => tone(880, 0.9, 0.05), 200);
    },
    get enabled() {
      return enabled;
    },
  };
}

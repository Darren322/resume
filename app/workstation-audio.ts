/**
 * Opt-in ambience for the workstation. Everything is synthesised with Web
 * Audio so the site ships no audio files, and nothing plays until the visitor
 * turns sound on (recruiters often browse in open offices).
 */
export type WorkstationAudio = {
  setEnabled: (enabled: boolean) => void;
  /** Paper handled or turned: a crinkle of short dry grains over a soft swish. */
  paper: () => void;
  /** Mechanical switches: one clack, or a loose rattle of several when lifted. */
  keys: (count?: number) => void;
  /** A screen stuttering on: mains buzz gated in time with the visual flicker. */
  flicker: () => void;
  /** Something solid set down on the walnut. */
  tap: () => void;
  dispose: () => void;
};

/** White noise, or pink (equal energy per octave: how a quiet room sounds). */
function noiseBuffer(context: AudioContext, seconds: number, pink = false) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  // Paul Kellet's economy pink filter.
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    if (pink) {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[index] = (b0 + b1 + b2 + white * 0.1848) * 0.2;
    } else {
      data[index] = white;
    }
  }
  return buffer;
}

export function createWorkstationAudio(): WorkstationAudio {
  let context: AudioContext | null = null;
  let master: GainNode | null = null;
  let enabled = false;

  const ensureGraph = () => {
    if (context) return context;
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0;
    master.connect(context.destination);

    // Room tone: a quiet night room, mostly soft air with the low end cut so
    // it never rumbles, drifting very slowly like air moving through a window.
    const air = context.createBufferSource();
    air.buffer = noiseBuffer(context, 6, true);
    air.loop = true;
    const airLow = context.createBiquadFilter();
    airLow.type = "highpass";
    airLow.frequency.value = 120;
    const airHigh = context.createBiquadFilter();
    airHigh.type = "lowpass";
    airHigh.frequency.value = 2200;
    const airGain = context.createGain();
    airGain.gain.value = 0.06;
    const drift = context.createOscillator();
    drift.frequency.value = 0.06;
    const driftDepth = context.createGain();
    driftDepth.gain.value = 0.02;
    drift.connect(driftDepth).connect(airGain.gain);
    drift.start();
    air.connect(airLow).connect(airHigh).connect(airGain).connect(master);
    air.start();

    // Lamp hum: a barely-there mains tone with one harmonic.
    [100, 200].forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      oscillator.frequency.value = frequency;
      const gain = context!.createGain();
      gain.gain.value = index === 0 ? 0.006 : 0.002;
      oscillator.connect(gain).connect(master!);
      oscillator.start();
    });
    return context;
  };

  return {
    setEnabled(next) {
      enabled = next;
      if (!next && !context) return;
      const audio = ensureGraph();
      if (audio.state === "suspended") void audio.resume();
      master!.gain.cancelScheduledValues(audio.currentTime);
      master!.gain.setTargetAtTime(next ? 0.55 : 0, audio.currentTime, 0.25);
    },
    paper() {
      if (!enabled || !context || !master) return;
      const now = context.currentTime;
      // The swish: band-limited noise swelling and fading as the sheet moves.
      const swish = context.createBufferSource();
      swish.buffer = noiseBuffer(context, 0.5, false);
      const swishFilter = context.createBiquadFilter();
      swishFilter.type = "bandpass";
      swishFilter.Q.value = 0.8;
      swishFilter.frequency.setValueAtTime(1400, now);
      swishFilter.frequency.linearRampToValueAtTime(3200, now + 0.35);
      const swishGain = context.createGain();
      swishGain.gain.setValueAtTime(0, now);
      swishGain.gain.linearRampToValueAtTime(0.1, now + 0.08);
      swishGain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);
      swish.connect(swishFilter).connect(swishGain).connect(master);
      swish.start(now);
      // The crinkle: a scatter of tiny bright grains as the fibres flex.
      const grains = 7 + Math.floor(Math.random() * 6);
      for (let index = 0; index < grains; index += 1) {
        const at = now + 0.02 + Math.random() * 0.36;
        const grain = context.createBufferSource();
        grain.buffer = noiseBuffer(context, 0.03, false);
        const filter = context.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 2500 + Math.random() * 3500;
        const gain = context.createGain();
        gain.gain.setValueAtTime(0.05 + Math.random() * 0.12, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.012 + Math.random() * 0.02);
        grain.connect(filter).connect(gain).connect(master);
        grain.start(at);
      }
    },
    keys(count = 1) {
      if (!enabled || !context || !master) return;
      const start = context.currentTime;
      for (let index = 0; index < count; index += 1) {
        const now = start + (index === 0 ? 0 : 0.03 + Math.random() * 0.22);
        const level = index === 0 ? 1 : 0.35 + Math.random() * 0.4;
        // Click: the switch's sharp top-out.
        const click = context.createBufferSource();
        click.buffer = noiseBuffer(context, 0.02, false);
        const clickFilter = context.createBiquadFilter();
        clickFilter.type = "bandpass";
        clickFilter.frequency.value = 3800 + Math.random() * 1200;
        clickFilter.Q.value = 1.4;
        const clickGain = context.createGain();
        clickGain.gain.setValueAtTime(0.32 * level, now);
        clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);
        click.connect(clickFilter).connect(clickGain).connect(master);
        click.start(now);
        // Thock: the keycap bottoming out on the plate, a fast-falling body tone.
        const body = context.createOscillator();
        body.type = "triangle";
        body.frequency.setValueAtTime(260 + Math.random() * 40, now + 0.004);
        body.frequency.exponentialRampToValueAtTime(110, now + 0.05);
        const bodyGain = context.createGain();
        bodyGain.gain.setValueAtTime(0, now);
        bodyGain.gain.linearRampToValueAtTime(0.22 * level, now + 0.006);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
        body.connect(bodyGain).connect(master);
        body.start(now);
        body.stop(now + 0.08);
      }
    },
    flicker() {
      if (!enabled || !context || !master) return;
      const now = context.currentTime;
      // Mains buzz through a resonant band, opened and shut in the same
      // stutter as the screen's CSS flicker, then a faint settle.
      const buzz = context.createOscillator();
      buzz.type = "sawtooth";
      buzz.frequency.value = 120;
      const band = context.createBiquadFilter();
      band.type = "bandpass";
      band.frequency.value = 1800;
      band.Q.value = 2;
      const gate = context.createGain();
      gate.gain.setValueAtTime(0, now);
      // [seconds from now, level] — matches the screenFlicker keyframes.
      const steps: Array<[number, number]> = [[0.0, 0.16], [0.06, 0], [0.12, 0.2], [0.16, 0.02], [0.24, 0.18], [0.3, 0.05], [0.36, 0.14]];
      steps.forEach(([at, level]) => gate.gain.setValueAtTime(level, now + at));
      gate.gain.setTargetAtTime(0, now + 0.42, 0.08);
      buzz.connect(band).connect(gate).connect(master);
      buzz.start(now);
      buzz.stop(now + 0.9);
      // Crackle on each strike.
      [0, 0.12, 0.24, 0.36].forEach((at) => {
        const crack = context!.createBufferSource();
        crack.buffer = noiseBuffer(context!, 0.015, false);
        const filter = context!.createBiquadFilter();
        filter.type = "highpass";
        filter.frequency.value = 5000;
        const gain = context!.createGain();
        gain.gain.setValueAtTime(0.14, now + at);
        gain.gain.exponentialRampToValueAtTime(0.001, now + at + 0.012);
        crack.connect(filter).connect(gain).connect(master!);
        crack.start(now + at);
      });
    },
    tap() {
      if (!enabled || !context || !master) return;
      const now = context.currentTime;
      const knock = context.createOscillator();
      knock.type = "sine";
      knock.frequency.setValueAtTime(140, now);
      knock.frequency.exponentialRampToValueAtTime(70, now + 0.08);
      const gain = context.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      knock.connect(gain).connect(master);
      knock.start(now);
      knock.stop(now + 0.14);
    },
    dispose() {
      void context?.close();
      context = null;
      master = null;
    },
  };
}

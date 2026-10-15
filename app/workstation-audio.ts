/**
 * Opt-in ambience for the workstation. Everything is synthesised with Web
 * Audio so the site ships no audio files, and nothing plays until the visitor
 * turns sound on (recruiters often browse in open offices).
 */
export type WorkstationAudio = {
  setEnabled: (enabled: boolean) => void;
  rustle: () => void;
  dispose: () => void;
};

function noiseBuffer(context: AudioContext, seconds: number, brown: boolean) {
  const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.5;
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

    // Room tone: low brown noise through a soft low-pass.
    const room = context.createBufferSource();
    room.buffer = noiseBuffer(context, 4, true);
    room.loop = true;
    const roomFilter = context.createBiquadFilter();
    roomFilter.type = "lowpass";
    roomFilter.frequency.value = 420;
    const roomGain = context.createGain();
    roomGain.gain.value = 0.32;
    room.connect(roomFilter).connect(roomGain).connect(master);
    room.start();

    // Lamp hum: a barely-there mains tone with one harmonic.
    [100, 200].forEach((frequency, index) => {
      const oscillator = context!.createOscillator();
      oscillator.frequency.value = frequency;
      const gain = context!.createGain();
      gain.gain.value = index === 0 ? 0.012 : 0.004;
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
    rustle() {
      if (!enabled || !context || !master) return;
      const source = context.createBufferSource();
      source.buffer = noiseBuffer(context, 0.45, false);
      const filter = context.createBiquadFilter();
      filter.type = "bandpass";
      filter.frequency.value = 2600;
      filter.Q.value = 0.7;
      const gain = context.createGain();
      const now = context.currentTime;
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);
      source.connect(filter).connect(gain).connect(master);
      source.start(now);
    },
    dispose() {
      void context?.close();
      context = null;
      master = null;
    },
  };
}

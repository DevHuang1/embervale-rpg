// Moss & Candlewax design reminder: sounds are brief, warm confirmations—not continuous ambience.

type AudioContextConstructor = new () => AudioContext;

let audioContext: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioContextClass = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: AudioContextConstructor }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") void audioContext.resume();
  return audioContext;
}

function chime(frequency: number, startOffset: number, duration: number, volume: number, type: OscillatorType = "sine") {
  const context = getContext();
  if (!context) return;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const start = context.currentTime + startOffset;
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

export function prepareInterfaceAudio() {
  void getContext();
}

export function playSatchelSound(opening: boolean) {
  if (opening) {
    chime(392, 0, 0.12, 0.045, "triangle");
    chime(587.33, 0.075, 0.16, 0.038, "sine");
    return;
  }
  chime(493.88, 0, 0.11, 0.035, "triangle");
  chime(329.63, 0.06, 0.13, 0.028, "sine");
}

export function playLootSound() {
  chime(523.25, 0, 0.13, 0.045, "triangle");
  chime(659.25, 0.08, 0.16, 0.042, "sine");
  chime(783.99, 0.17, 0.23, 0.038, "sine");
}

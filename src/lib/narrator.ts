/**
 * Zero-dependency Web Speech API Chinese Storytelling Narrator ("明月说书旁白").
 * Tracks live playback state so any UI button can cleanly toggle & stop speech immediately.
 */

export interface NarrationState {
  isSpeaking: boolean;
  source: string | null;
}

type NarrationListener = (state: NarrationState) => void;

let currentState: NarrationState = { isSpeaking: false, source: null };
let activeUtterance: SpeechSynthesisUtterance | null = null;
const listeners = new Set<NarrationListener>();

function emitNarrationState(next: NarrationState): void {
  if (
    currentState.isSpeaking === next.isSpeaking &&
    currentState.source === next.source
  ) {
    return;
  }
  currentState = next;
  for (const fn of listeners) {
    fn(currentState);
  }
}

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

export function getNarrationState(): NarrationState {
  return currentState;
}

export function subscribeNarrationState(
  listener: NarrationListener
): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function stopAtlasNarration(): void {
  activeUtterance = null;
  if (isSpeechSupported()) {
    try {
      // Chrome/Edge quirk: resume before cancel ensures paused/stuck queues flush immediately
      if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
      }
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
  }
  emitNarrationState({ isSpeaking: false, source: null });
}

function pickBestChineseVoice(): SpeechSynthesisVoice | null {
  if (!isSpeechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const zhVoices = voices.filter((v) =>
    /^(zh|cmn)/i.test(v.lang.replace('_', '-'))
  );
  if (zhVoices.length === 0) return null;

  // Prefer natural neural voices on Windows/Edge/macOS/iOS/Android when available
  const preferred = zhVoices.find((v) =>
    /(Xiaoxiao|Yunxi|Yunjian|Tingting|Meijia|Google\s*普通话)/i.test(v.name)
  );
  return preferred ?? zhVoices.find((v) => /CN/i.test(v.lang)) ?? zhVoices[0];
}

export function speakAtlasText(
  text: string,
  rate = 1.06,
  source = 'global'
): void {
  if (!isSpeechSupported()) return;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return;

  try {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
    }
    window.speechSynthesis.cancel();

    const utter = new window.SpeechSynthesisUtterance(cleaned);
    utter.lang = 'zh-CN';
    utter.rate = Math.max(0.85, Math.min(1.45, rate));
    utter.pitch = 1.0;
    const voice = pickBestChineseVoice();
    if (voice) {
      utter.voice = voice;
    }

    activeUtterance = utter;
    emitNarrationState({ isSpeaking: true, source });

    const finishIfCurrent = () => {
      if (activeUtterance === utter) {
        activeUtterance = null;
        emitNarrationState({ isSpeaking: false, source: null });
      }
    };
    utter.onend = finishIfCurrent;
    utter.onerror = finishIfCurrent;

    window.speechSynthesis.speak(utter);
  } catch {
    activeUtterance = null;
    emitNarrationState({ isSpeaking: false, source: null });
  }
}

/**
 * Toggles speech playback cleanly:
 * - If currently speaking, immediately stops narration and returns `false`.
 * - Otherwise starts speaking `text` and returns `true`.
 */
export function toggleSpeakAtlasText(
  text: string,
  rate = 1.06,
  source = 'drawer'
): boolean {
  const synthActive =
    isSpeechSupported() &&
    (window.speechSynthesis.speaking || window.speechSynthesis.pending);

  if (currentState.isSpeaking || synthActive) {
    stopAtlasNarration();
    return false;
  }

  speakAtlasText(text, rate, source);
  return true;
}

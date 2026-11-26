/**
 * Zero-dependency Web Speech API Chinese Storytelling Narrator ("明月说书旁白").
 * Safely degrades to no-op on SSR or browsers without `speechSynthesis`.
 */

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof window.SpeechSynthesisUtterance !== 'undefined'
  );
}

export function stopAtlasNarration(): void {
  if (!isSpeechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
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

export function speakAtlasText(text: string, rate = 1.06): void {
  if (!isSpeechSupported()) return;
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return;

  try {
    window.speechSynthesis.cancel();
    const utter = new window.SpeechSynthesisUtterance(cleaned);
    utter.lang = 'zh-CN';
    utter.rate = Math.max(0.85, Math.min(1.45, rate));
    utter.pitch = 1.0;
    const voice = pickBestChineseVoice();
    if (voice) {
      utter.voice = voice;
    }
    window.speechSynthesis.speak(utter);
  } catch {
    // ignore browser autoplay / speech errors gracefully
  }
}

import { generateChat, type LLMConfig } from './LLMService';
import { loadSettings, getActiveConfig } from './SettingsService';

export async function translateLabels(
  labels: readonly string[],
  signal?: AbortSignal,
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (labels.length === 0) return result;

  // Already Japanese or too short to translate
  const needsTranslation = labels.filter((l) => {
    if (l.length <= 2) return false;
    return !/[　-〿぀-ゟ゠-ヿ＀-￯一-龯㐀-䶿]/.test(l);
  });

  if (needsTranslation.length === 0) {
    for (const l of labels) result.set(l, l);
    return result;
  }

  for (const l of labels) {
    if (!needsTranslation.includes(l)) {
      result.set(l, l);
    }
  }

  const settings = loadSettings();
  const config = getActiveConfig(settings);
  if (!config) {
    for (const l of needsTranslation) result.set(l, l);
    return result;
  }

  const numbered = needsTranslation.map((l, i) => `${i + 1}. ${l}`).join('\n');

  try {
    const response = await generateChat(
      config,
      [{ role: 'user', content: numbered }],
      `以下のソフトウェア図のラベルを日本語に翻訳してください。出力は番号とラベルのみ、1行に1つ、形式は "番号. 日本語" とします。余計な説明は不要です。`,
      signal,
    );

    const translations = response
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^\d+\./.test(line));

    for (const line of translations) {
      const match = line.match(/^(\d+)\.\s*(.+)/);
      if (match) {
        const idx = parseInt(match[1], 10) - 1;
        if (idx >= 0 && idx < needsTranslation.length) {
          result.set(needsTranslation[idx], match[2].trim());
        }
      }
    }

    // Fill in any missing translations
    for (const l of needsTranslation) {
      if (!result.has(l)) result.set(l, l);
    }
  } catch (err) {
    for (const l of needsTranslation) result.set(l, l);
    throw err;
  }

  return result;
}

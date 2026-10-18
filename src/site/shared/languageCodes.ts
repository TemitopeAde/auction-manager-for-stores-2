export type SupportedLanguageCode =
  | 'en'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'it'
  | 'nl'
  | 'ru'
  | 'ar'
  | 'hi'
  | 'bn'
  | 'ur'
  | 'tr'
  | 'zh'
  | 'ja'
  | 'ko'
  | 'id'
  | 'vi'
  | 'pl'
  | 'th';

export const SUPPORTED_LANGUAGE_OPTIONS: Array<{
  id: SupportedLanguageCode;
  value: string;
}> = [
  { id: 'en', value: 'English' },
  { id: 'es', value: 'Spanish' },
  { id: 'fr', value: 'French' },
  { id: 'de', value: 'German' },
  { id: 'pt', value: 'Portuguese' },
  { id: 'it', value: 'Italian' },
  { id: 'nl', value: 'Dutch' },
  { id: 'ru', value: 'Russian' },
  { id: 'ar', value: 'Arabic' },
  { id: 'hi', value: 'Hindi' },
  { id: 'bn', value: 'Bengali' },
  { id: 'ur', value: 'Urdu' },
  { id: 'tr', value: 'Turkish' },
  { id: 'zh', value: 'Chinese (Simplified)' },
  { id: 'ja', value: 'Japanese' },
  { id: 'ko', value: 'Korean' },
  { id: 'id', value: 'Indonesian' },
  { id: 'vi', value: 'Vietnamese' },
  { id: 'pl', value: 'Polish' },
  { id: 'th', value: 'Thai' },
];

export const RTL_LANGUAGES = new Set<SupportedLanguageCode>(['ar', 'ur']);

export function parseBooleanLanguageProp(
  value?: boolean | string,
  fallback = true,
): boolean {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return value !== false && value !== 'false';
}

export function parseLanguageCode(
  value: string | null | undefined,
): SupportedLanguageCode | null {
  const normalized = (value ?? '').toLowerCase().trim();
  if (!normalized) {
    return null;
  }

  const baseCode = normalized.split(/[-_]/)[0] as SupportedLanguageCode;
  return SUPPORTED_LANGUAGE_OPTIONS.some((option) => option.id === baseCode)
    ? baseCode
    : null;
}

export function normalizeLanguageCode(
  value: string | null | undefined,
): SupportedLanguageCode {
  return parseLanguageCode(value) ?? 'en';
}

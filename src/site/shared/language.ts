import { useEffect, useState } from 'react';
import { multilingual } from '@wix/site';
import {
  normalizeLanguageCode,
  parseBooleanLanguageProp,
  parseLanguageCode,
  type SupportedLanguageCode,
} from './languageCodes';

export {
  type SupportedLanguageCode,
  SUPPORTED_LANGUAGE_OPTIONS,
  RTL_LANGUAGES,
  parseBooleanLanguageProp,
  parseLanguageCode,
  normalizeLanguageCode,
} from './languageCodes';

async function readEssentialsLanguage(): Promise<string | null> {
  try {
    const essentials = (
      globalThis as {
        essentials?: { i18n?: { getLanguage?: () => string } };
      }
    ).essentials;
    const language = essentials?.i18n?.getLanguage?.();
    if (typeof language === 'string' && language.trim()) {
      return language;
    }
  } catch {
    // Site custom elements may not expose essentials on globalThis.
  }

  try {
    const essentials = await import('@wix/essentials');
    const language = essentials.i18n?.getLanguage?.();
    if (typeof language === 'string' && language.trim()) {
      return language;
    }
  } catch {
    // Optional: @wix/essentials is not always available in the site runtime.
  }

  return null;
}

async function readCurrentSiteLanguage(): Promise<string | null> {
  try {
    const multilingualApi =
      (
        window as unknown as {
          essentials?: { multilingual?: { currentLanguage?: unknown } };
        }
      )?.essentials?.multilingual ??
      (
        globalThis as unknown as {
          globals?: {
            $ns?: {
              'wix-window'?: { multilingual?: { currentLanguage?: unknown } };
            };
          };
        }
      )?.globals?.$ns?.['wix-window']?.multilingual;
    const currentLanguage = multilingualApi?.currentLanguage;

    if (typeof currentLanguage === 'function') {
      const resolvedCurrentLanguage = await currentLanguage();
      if (typeof resolvedCurrentLanguage === 'string') {
        return resolvedCurrentLanguage;
      }
    }

    if (typeof currentLanguage === 'string') {
      return currentLanguage;
    }
  } catch (error) {
    console.warn('[smart-auction] failed to read current site language', error);
  }

  try {
    const supportedLanguages = multilingual.listSupportedLanguages();
    const current = supportedLanguages.find((language) => {
      const flags = language as { isPrimary?: boolean; current?: boolean };
      return flags.current === true || flags.isPrimary === true;
    });

    if (current?.id) {
      return current.id;
    }
  } catch (error) {
    console.warn('[smart-auction] failed to inspect supported languages', error);
  }

  return null;
}

export async function detectSiteLanguage(
  fallbackLanguage?: string,
  autoDetect = true,
): Promise<SupportedLanguageCode> {
  const fallback = normalizeLanguageCode(fallbackLanguage);

  if (!autoDetect) {
    return fallback;
  }

  const candidates = [
    await readEssentialsLanguage(),
    await readCurrentSiteLanguage(),
    typeof navigator !== 'undefined' ? navigator.language : null,
  ];

  for (const candidate of candidates) {
    const matched = parseLanguageCode(candidate);
    if (matched) {
      return matched;
    }
  }

  return fallback;
}

export function useDetectedLanguage(
  languageProp?: string,
  autoDetectProp?: boolean | string,
): SupportedLanguageCode {
  const autoDetect = parseBooleanLanguageProp(autoDetectProp, true);
  const [resolvedLanguage, setResolvedLanguage] = useState<SupportedLanguageCode>(
    () => normalizeLanguageCode(languageProp),
  );

  useEffect(() => {
    let active = true;

    void detectSiteLanguage(languageProp, autoDetect).then((nextLanguage) => {
      if (active) {
        setResolvedLanguage(nextLanguage);
      }
    });

    return () => {
      active = false;
    };
  }, [autoDetect, languageProp]);

  return resolvedLanguage;
}

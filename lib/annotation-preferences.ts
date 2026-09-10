import type { Annotation } from './model';
export const ANNOTATION_PREFERENCES_KEY = 'paperthread-annotation-preferences';
export function annotationPreferences(
  raw: string | null,
): Partial<Pick<Annotation, 'color' | 'kind' | 'types'>> {
  try {
    const value = JSON.parse(raw || '{}');
    return {
      ...(/^#[\da-f]{6}$/i.test(value.color) ? { color: value.color } : {}),
      ...(['highlight', 'underline', 'note'].includes(value.kind)
        ? { kind: value.kind }
        : {}),
      ...(Array.isArray(value.types)
        ? {
            types: [
              ...new Set<string>(
                value.types.filter(
                  (t: unknown) => t === 'question' || t === 'phrase',
                ),
              ),
            ],
          }
        : {}),
    };
  } catch {
    return {};
  }
}

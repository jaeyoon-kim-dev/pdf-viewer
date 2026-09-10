// The copy-event fallback also works on the private HTTP deployment, where
// navigator.clipboard is unavailable. It does not focus a hidden input.
export function legacyCopy(text: string): boolean {
  let copied = false;
  const listener = (event: ClipboardEvent) => {
    if (!event.clipboardData) return;
    event.preventDefault();
    event.clipboardData.setData('text/plain', text);
    copied = true;
  };
  document.addEventListener('copy', listener);
  try {
    // Private HTTP origins have no Clipboard API; retain this user-gesture fallback.
    // eslint-disable-next-line typescript/no-deprecated
    return document.execCommand('copy') && copied;
  } finally {
    document.removeEventListener('copy', listener);
  }
}
export async function copyText(
  text: string,
  options: {
    writeText?: (text: string) => Promise<void>;
    fallback: (text: string) => boolean;
  } = {
    writeText: navigator.clipboard?.writeText.bind(navigator.clipboard),
    fallback: legacyCopy,
  },
): Promise<void> {
  if (options.writeText) {
    try {
      await options.writeText(text);
      return;
    } catch {
      /* Try the user-initiated copy event. */
    }
  }
  if (!options.fallback(text))
    throw new Error(
      'Copy was blocked by the browser. Try Cmd/Ctrl+C while the PDF text is selected.',
    );
}

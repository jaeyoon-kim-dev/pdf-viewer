'use client';
import { useEffect, useState } from 'react';
type InstallEvent = Event & {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};
export default function Pwa() {
  const [install, setInstall] = useState<InstallEvent>();
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production')
      void navigator.serviceWorker.register('/sw.js').catch(() => {});
    const listener = (e: Event) => {
      e.preventDefault();
      setInstall(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', listener);
    return () => window.removeEventListener('beforeinstallprompt', listener);
  }, []);
  return install ? (
    <button
      className="secondary-button"
      onClick={async () => {
        await install.prompt();
        await install.userChoice;
        setInstall(undefined);
      }}
    >
      Install app
    </button>
  ) : null;
}

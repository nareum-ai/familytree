interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let _prompt: BeforeInstallPromptEvent | null = null;

export function getInstallPrompt() { return _prompt; }
export function clearInstallPrompt() { _prompt = null; }

export function initInstallPromptListener() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _prompt = e as BeforeInstallPromptEvent;
  });
}

export async function triggerInstall(): Promise<boolean> {
  if (!_prompt) return false;
  await _prompt.prompt();
  const { outcome } = await _prompt.userChoice;
  if (outcome === 'accepted') _prompt = null;
  return outcome === 'accepted';
}

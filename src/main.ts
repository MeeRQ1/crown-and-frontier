import './ui/style.css';

const fill = document.getElementById('boot-fill');
const text = document.getElementById('boot-text');
const progress = (pct: number, msg: string) => {
  if (fill) fill.style.width = `${pct}%`;
  if (text) text.textContent = msg;
};

async function start(): Promise<void> {
  progress(20, 'Preparing the world…');
  const { App } = await import('./ui/app');
  progress(45, 'Gathering the realms…');
  const root = document.getElementById('app')!;
  const app = new App(root);
  (window as unknown as { cnf?: unknown }).cnf = app; // debugging handle (inspect only)
  await app.boot(progress);
  document.getElementById('boot')?.remove();
}

start().catch((e) => {
  console.error(e);
  progress(100, `The game could not start: ${(e as Error).message}. Try reloading, or a different browser.`);
});

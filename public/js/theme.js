// Runs before the page paints so a saved theme never flashes the wrong colors.
try {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') document.documentElement.dataset.theme = saved;
} catch {
  // Storage can be blocked (private mode); the system theme is used then.
}

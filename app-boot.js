try {
  await import('./trophy.js');
} catch (error) {
  console.error('CSO Trophy Studio failed to initialize:', error);
  const message = document.createElement('section');
  message.setAttribute('role', 'alert');
  message.style.cssText = 'margin:16px;padding:16px;border:1px solid #a85b45;border-radius:12px;background:#351d1b;color:#ffe0d7;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif';
  const title = document.createElement('strong');
  title.textContent = 'Trophy Studio could not finish loading.';
  const detail = document.createElement('p');
  detail.textContent = 'Your saved trophies and hunting data have not been deleted. Close this app, reopen it while online, and try again. Details: ' + (error?.message || 'unknown startup error');
  const link = document.createElement('a');
  link.href = './index.html?refresh=1';
  link.textContent = 'Reload Trophy Studio';
  link.style.cssText = 'display:inline-block;margin-top:8px;color:#ffd09b;font-weight:700';
  message.append(title, detail, link);
  document.body.prepend(message);
}

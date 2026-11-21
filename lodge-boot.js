try {
  await import('./lodge.js');
} catch (error) {
  console.error('CSO Lodge failed to initialize:', error);
  const message = document.createElement('section');
  message.setAttribute('role', 'alert');
  message.style.cssText = 'margin:16px;padding:16px;border:1px solid #a85b45;border-radius:12px;background:#351d1b;color:#ffe0d7;font:14px/1.5 -apple-system,BlinkMacSystemFont,sans-serif';
  message.textContent = 'The Lodge display could not finish loading. Your saved trophies have not been deleted. Use the Trophy Studio link above to return, then reopen while online. Details: ' + (error?.message || 'unknown startup error');
  document.body.prepend(message);
}

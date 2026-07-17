(() => {
  const routes = {
    home: 'index.html',
    dashboard: 'index.html',
    assistant: 'assistant.html',
    pay: 'payments.html',
    payments: 'payments.html',
    transfers: 'payments.html',
    insight: 'profile.html',
    insights: 'profile.html',
    profile: 'profile.html',
    settings: 'profile.html',
    identity: 'kyc.html',
    kyc: 'kyc.html',
    security: 'security.html'
  };

  const normalize = (value) => value.trim().toLowerCase().replace(/[^a-z]/g, '');

  document.querySelectorAll('a, nav > div').forEach((item) => {
    const words = item.textContent.trim().split(/\s+/).map(normalize);
    const routeKey = words.find((word) => routes[word]);
    if (!routeKey) return;
    item.style.cursor = 'pointer';
    if (item.tagName === 'A') item.href = routes[routeKey];
    else item.addEventListener('click', () => { window.location.href = routes[routeKey]; });
  });

  const toast = document.createElement('div');
  toast.setAttribute('role', 'status');
  toast.className = 'fixed right-6 top-6 z-[200] max-w-sm translate-y-[-140%] rounded-xl border border-primary/30 bg-surface-container-high/95 px-5 py-4 text-sm text-on-surface shadow-2xl backdrop-blur-xl transition-transform duration-300';
  document.body.appendChild(toast);
  let toastTimer;

  window.moovNotify = (message) => {
    toast.textContent = message;
    toast.classList.remove('translate-y-[-140%]');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.add('translate-y-[-140%]'), 2800);
  };

  document.querySelectorAll('button').forEach((button) => {
    if (button.hasAttribute('onclick')) return;
    button.addEventListener('click', () => {
      const action = button.textContent.trim().replace(/\s+/g, ' ');
      if (!action) return;
      if (/send money|transfer|pay/i.test(action)) {
        window.location.href = 'payments.html';
        return;
      }
      moovNotify(`${action} — démonstration activée. La connexion API sera ajoutée ensuite.`);
    });
  });

  const assistantInput = document.querySelector('input[placeholder*="Message Moov Assist"]');
  if (assistantInput) {
    const send = assistantInput.parentElement.querySelector('button:last-child');
    const submit = () => {
      const message = assistantInput.value.trim();
      if (!message) return;
      assistantInput.value = '';
      moovNotify(`Message reçu : « ${message} ». Réponse simulée en attendant le moteur IA.`);
    };
    send?.addEventListener('click', submit);
    assistantInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') submit();
    });
  }
})();

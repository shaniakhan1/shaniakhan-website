/* Shared lead-form transport. Configure endpoints here when changing providers.
 * The provider must return HTTP 2xx JSON with success: true and the matching id.
 * Acceptance is not proof of inbox delivery. Never put private API keys here.
 */
(function () {
  'use strict';
  const config = {
    endpoint: 'https://nuxkwgbguvpaoigrzqqa.supabase.co/functions/v1/website-inquiry', // Set the verified website-inquiry endpoint before publishing.
    publicKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51eGt3Z2JndXZwYW9pZ3J6cXFhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NDc2ODAsImV4cCI6MjA5MDAyMzY4MH0.HWr4dykudUbTLfVntdLHKfCOJqGuKekOPz4hkYFT3K0', // Supabase public anon key only, never a service-role key.
    email: 'shania@flpmarketinggroup.com',
    timeoutMs: 25000
  };
  const subjects = {
    'consult-form': 'New Private Advisory Inquiry',
    'apply-form': 'New Mastermind Application',
    'waitlist-form': 'New Mastermind Waitlist Signup'
  };
  const states = new WeakMap();
  function payload(form) {
    const fields = Object.fromEntries(new FormData(form));
    Object.keys(fields).filter(key => key.startsWith('_')).forEach(key => delete fields[key]);
    const website = fields.website || '';
    delete fields.website;
    return { type: { 'consult-form': 'consult', 'apply-form': 'mastermind-application', 'waitlist-form': 'mastermind-waitlist' }[form.id], fields, website };
  }

  function prepare(form) {
    if (states.has(form)) return states.get(form);
    const panel = document.createElement('div');
    panel.className = 'lead-form-help';
    panel.style.cssText = 'margin:1.25rem 0;font:400 14px/1.6 sans-serif;overflow-wrap:anywhere';
    const status = document.createElement('p');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const link = form.querySelector('[data-lead-fallback]');
    const updateLink = () => {
      const data = payload(form);
      const body = Object.entries(data.fields)
        .map(([key, value]) => key + ': ' + value).join('\n\n');
      link.href = 'mailto:' + config.email + '?subject=' + encodeURIComponent(subjects[form.id]) + '&body=' + encodeURIComponent(body);
    };
    link.addEventListener('click', updateLink);
    updateLink();
    if (!config.endpoint || !config.publicKey) {
      status.textContent = 'Online sending is temporarily unavailable. You can complete this form and continue by email, or email Shania directly using the link above.';
      form.querySelectorAll('[type="submit"]').forEach(button => { button.textContent = 'Continue by email'; });
    }
    panel.append(status);
    form.after(panel);
    const state = { busy: false, accepted: false, status };
    states.set(form, state);
    return state;
  }
  async function submit(form) {
    const state = prepare(form);
    if (state.busy || state.accepted) return;
    if (!form.reportValidity()) return;
    if (!config.endpoint || !config.publicKey) {
      state.status.textContent = 'Review and send your answers in your email app. Nothing has been sent yet. If it does not open, email your answers to ' + config.email + '.';
      form.querySelector('[data-lead-fallback]').click();
      return;
    }
    state.busy = true;
    const buttons = Array.from(form.querySelectorAll('[type="submit"]'));
    const originals = buttons.map(button => [button, button.textContent, button.disabled]);
    buttons.forEach(button => { button.disabled = true; button.textContent = 'Sending…'; });
    form.setAttribute('aria-busy', 'true');
    state.status.textContent = 'Sending your details…';
    let timer;
    try {
      const controller = new AbortController();
      const data = payload(form);
      const fingerprint = JSON.stringify(data);
      if (state.fingerprint !== fingerprint) { state.id = crypto.randomUUID(); state.fingerprint = fingerprint; }
      data.id = state.id;
      // Race the entire response, including JSON parsing, against a deadline.
      const request = (async () => {
        if (!config.endpoint || !config.publicKey) throw new Error('Endpoint not configured');
        const response = await fetch(config.endpoint, {
          method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Authorization: 'Bearer ' + config.publicKey, apikey: config.publicKey },
          body: JSON.stringify(data), signal: controller.signal
        });
        if (!response.ok) throw new Error('HTTP failure');
        const result = await response.json();
        if (result.success !== true || result.id !== state.id) throw new Error('Provider rejected request');
      })();
      await Promise.race([request, new Promise((_, reject) => {
        timer = setTimeout(() => { controller.abort(); reject(new Error('Timeout')); }, config.timeoutMs);
      })]);
      state.accepted = true;
      state.status.textContent = 'Thank you. Your ' + ({ 'consult-form': 'note', 'apply-form': 'application', 'waitlist-form': 'waitlist request' }[form.id]) + ' has been received.';
    } catch (_) {
      state.status.textContent = 'We could not confirm that your submission was received. Your answers are still here. Please email them using the email link, or try again.';
    } finally {
      clearTimeout(timer);
      state.busy = false;
      form.setAttribute('aria-busy', 'false');
      originals.forEach(([button, label, disabled]) => {
        button.disabled = state.accepted || disabled;
        button.textContent = state.accepted ? 'Submitted' : label;
      });
    }
  }
  window.LeadForms = { submit };
  function initialize() {
    document.querySelectorAll('#consult-form, #apply-form, #waitlist-form').forEach(prepare);
  }
  document.addEventListener('submit', event => {
    if (!subjects[event.target.id]) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void submit(event.target);
  }, true);
  new MutationObserver(initialize).observe(document.documentElement, { childList: true, subtree: true });
  initialize();
})();

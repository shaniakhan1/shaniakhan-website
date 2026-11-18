/* Soft60 marketing attribution: anonymous, no session replay, no automatic DOM capture. */
(function () {
  'use strict';
  if (navigator.globalPrivacyControl || navigator.doNotTrack === '1') return;
  var PROJECT_KEY = 'phc_ogtg0XDWsaWMr2VFVEqW9akACC2kZgumIuj0uT7GtKj';
  var HOST = 'https://us.i.posthog.com';
  var site = location.hostname.indexOf('shaniakhan') !== -1 ? 'shaniakhan_com' : 'soft60_app';
  var allowed = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  var search = new URLSearchParams(location.search);
  var campaign = {};
  allowed.forEach(function (key) {
    var value = search.get(key);
    if (value && /^[a-zA-Z0-9_.-]{1,70}$/.test(value)) campaign[key] = value;
  });
  var referrer = '';
  try { referrer = document.referrer ? new URL(document.referrer).hostname.slice(0, 80) : ''; } catch (_) {}
  var safePath = function (url) { try { return new URL(url, location.href).pathname.slice(0, 120); } catch (_) { return '/'; } };
  var page = safePath(location.href);
  var labels = {
    'apps.apple.com': 'app_store',
    'play.google.com': 'google_play',
    'app.frequencyplanner.com': 'web_app',
    'soft60.app': 'soft60_site',
    'www.soft60.app': 'soft60_site',
    'iamshaniakhan.substack.com': 'newsletter'
  };
  function destination(url) {
    try {
      var u = new URL(url, location.href);
      var host = u.hostname.toLowerCase();
      if (u.protocol !== 'https:' && u.protocol !== 'http:') return 'unknown';
      // Treat www aliases as the same site before assigning cross-site intent.
      if (host.replace(/^www\./, '') === location.hostname.toLowerCase().replace(/^www\./, '')) return 'internal';
      if ((host === 'substack.com' || host === 'www.substack.com') && /^\/@iamshaniakhan(?:\/|$)/.test(u.pathname)) return 'newsletter';
      if (labels[host]) return labels[host];
      if (host === 'shaniakhan.com' || host === 'www.shaniakhan.com') return 'founder_site';
      return 'external';
    } catch (_) { return 'unknown'; }
  }
  function action(a) {
    var href = a.getAttribute('href') || '';
    var dest = destination(href);
    if (dest === 'internal' || dest === 'external' || dest === 'unknown') return '';
    if (dest === 'web_app' && href.indexOf('/frequency') !== -1) return 'assessment';
    if (dest === 'app_store' || dest === 'google_play') return 'app_download';
    if (dest === 'newsletter') return 'newsletter';
    if (dest === 'soft60_site') return 'app_discovery';
    return 'app_entry';
  }
  function capture(event, properties) {
    try {
      if (!window.posthog || !window.posthog.capture) return;
      window.posthog.capture(event, Object.assign({site: site, page: page}, campaign, properties || {}));
    } catch (_) {}
  }
  // The existing Soft60 app uses this PostHog project; a separate anonymous visit is
  // not a confirmed app install, trial activation, purchase, or cross-domain person match.
  function start() {
    if (!window.posthog) return;
    window.posthog.init(PROJECT_KEY, {
      api_host: HOST,
      persistence: 'memory',
      person_profiles: 'identified_only',
      capture_pageview: false,
      capture_pageleave: false,
      autocapture: false,
      disable_session_recording: true,
      disable_surveys: true,
      before_send: function (event) {
        if (!event || !event.properties) return event;
        // SDK-added session/initial/referrer URLs can contain arbitrary query values.
        // Only keep explicit marketing fields and anonymous SDK identifiers.
        var original = event.properties;
        var p = {};
        ['distinct_id', '$device_id', '$session_id', '$window_id', '$lib', '$lib_version', '$insert_id', '$time', '$is_identified', '$process_person_profile'].forEach(function (key) {
          if (Object.prototype.hasOwnProperty.call(original, key)) p[key] = original[key];
        });
        Object.assign(p, {site: site, page: page}, campaign);
        ['cta_kind', 'destination', 'exercise', 'duration_seconds'].forEach(function (key) {
          if (typeof original[key] === 'number' || (typeof original[key] === 'string' && /^[a-zA-Z0-9_.-]{1,70}$/.test(original[key]))) p[key] = original[key];
        });
        if (event.event === 'marketing_landing_viewed') p.referring_domain = referrer || 'direct';
        p.$current_url = location.origin + page;
        p.$pathname = page;
        event.properties = p;
        return event;
      }
    });
    capture('marketing_landing_viewed', {referring_domain: referrer || 'direct'});
  }
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var kind = action(a);
    if (!kind) return;
    capture('marketing_cta_clicked', {cta_kind: kind, destination: destination(a.href)});
  }, true);
  if (!window.posthog) {
    !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture identify reset opt_in_capturing opt_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);
  }
  start();
})();

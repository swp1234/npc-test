/* i18n module for npc-test app */
(function() {
  'use strict';
  try {
    var SUPPORTED = ['ko','en','ja','es','pt','zh','id','tr','de','fr','hi','ru'];
    var DEFAULT_LANG = 'ko';

    function I18n() {
      this.lang = DEFAULT_LANG;
      this.translations = {};
      this.loaded = false;
    }

    I18n.prototype.getSeoHref = function(lang) {
      var links = document.querySelectorAll('link[rel="alternate"][hreflang]');
      var hrefMap = {};
      for (var i = 0; i < links.length; i++) {
        var hreflang = links[i].getAttribute('hreflang');
        if (hreflang) hrefMap[hreflang] = links[i].href;
      }
      return hrefMap[lang] || hrefMap['x-default'] || ((document.querySelector('link[rel="canonical"]') || {}).href) || window.location.href;
    };

    I18n.prototype.syncSeoState = function(lang, updateHistory) {
      var currentUrl = new URL(window.location.href);
      var currentHasLangParam = currentUrl.searchParams.has('lang');
      var targetHref = this.getSeoHref(updateHistory || currentHasLangParam ? lang : 'x-default');
      if (targetHref) {
        var canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) canonical.href = targetHref;
        var ogUrl = document.querySelector('meta[property="og:url"]');
        if (ogUrl) ogUrl.content = targetHref;
        var twitterUrl = document.querySelector('meta[name="twitter:url"]');
        if (twitterUrl) twitterUrl.content = targetHref;
      }
      if (updateHistory && targetHref) {
        var nextUrl = new URL(targetHref);
        nextUrl.hash = currentUrl.hash;
        if (currentUrl.pathname !== nextUrl.pathname || currentUrl.search !== nextUrl.search || currentUrl.hash !== nextUrl.hash) {
          window.history.replaceState({}, '', nextUrl.pathname + nextUrl.search + nextUrl.hash);
        }
      }
    };

    I18n.prototype.detectLanguage = function() {
      // URL param first
      var params = new URLSearchParams(window.location.search);
      var urlLang = params.get('lang');
      if (urlLang && SUPPORTED.indexOf(urlLang) !== -1) return urlLang;

      // localStorage
      var stored = localStorage.getItem('npc-test-lang');
      if (stored && SUPPORTED.indexOf(stored) !== -1) return stored;

      // Browser language
      var browserLang = (navigator.language || navigator.userLanguage || '').slice(0, 2).toLowerCase();
      if (SUPPORTED.indexOf(browserLang) !== -1) return browserLang;

      return DEFAULT_LANG;
    };

    I18n.prototype.load = function(lang, updateHistory) {
      var self = this;
      this.lang = lang;
      localStorage.setItem('npc-test-lang', lang);
      document.documentElement.lang = lang;

      return fetch('js/locales/' + lang + '.json?v=' + Date.now())
        .then(function(res) { return res.json(); })
        .then(function(data) {
          self.translations = data;
          self.loaded = true;
          self.applyAll();
          self.syncSeoState(self.lang, !!updateHistory);
          return data;
        })
        .catch(function(err) {
          console.warn('[i18n] Failed to load ' + lang + ':', err);
          if (lang !== DEFAULT_LANG) {
            return self.load(DEFAULT_LANG);
          }
        });
    };

    I18n.prototype.t = function(key, fallback) {
      var keys = key.split('.');
      var val = this.translations;
      for (var i = 0; i < keys.length; i++) {
        if (val && typeof val === 'object' && keys[i] in val) {
          val = val[keys[i]];
        } else {
          return fallback || key;
        }
      }
      return val || fallback || key;
    };

    I18n.prototype.applyAll = function() {
      // Text content
      var els = document.querySelectorAll('[data-i18n]');
      for (var i = 0; i < els.length; i++) {
        var key = els[i].getAttribute('data-i18n');
        var val = this.t(key);
        if (val && val !== key) {
          if (els[i].tagName === 'INPUT' || els[i].tagName === 'TEXTAREA') {
            els[i].placeholder = val;
          } else {
            els[i].textContent = val;
          }
        }
      }

      // Attribute translations (meta tags etc)
      var attrEls = document.querySelectorAll('[data-i18n-attr]');
      for (var j = 0; j < attrEls.length; j++) {
        var attr = attrEls[j].getAttribute('data-i18n-attr');
        var k = attrEls[j].getAttribute('data-i18n');
        var v = this.t(k);
        if (v && v !== k) {
          attrEls[j].setAttribute(attr, v);
        }
      }

      // Update lang selector
      var langSelect = document.getElementById('langSelect');
      if (langSelect) langSelect.value = this.lang;

      // Title
      var title = this.t('meta.title');
      if (title && title !== 'meta.title') document.title = title;
      this.syncSeoState(this.lang, false);
    };

    I18n.prototype.init = function() {
      var self = this;
      var lang = this.detectLanguage();

      // Lang selector event
      var langSelect = document.getElementById('langSelect');
      if (langSelect) {
        langSelect.value = lang;
        langSelect.addEventListener('change', function() {
          self.load(this.value, true);
          // Dispatch event for app to react
          window.dispatchEvent(new CustomEvent('langchange', { detail: { lang: this.value } }));
        });
      }

      return this.load(lang);
    };

    // Export
    window.I18n = I18n;
    window.i18n = new I18n();

    // Auto-init on DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        window.i18n.init();
      });
    } else {
      window.i18n.init();
    }

  } catch (e) {
    console.error('[i18n] Init error:', e);
  }
})();

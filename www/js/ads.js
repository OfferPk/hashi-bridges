/** AdMob stub — no-ops in browser; Capacitor plugin hook points for Android later. */
(function (root) {
  'use strict';
  const Ads = {
    async init() { /* UMP + SDK init stub */ },
    showBanner() {},
    hideBanner() {},
    async maybeInterstitial() { return false; },
    async showRewarded(cb) { if (typeof cb === 'function') cb(true); return true; },
  };
  root.Ads = Ads;
})(typeof self !== 'undefined' ? self : this);

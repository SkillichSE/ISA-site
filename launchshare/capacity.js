// Launchshare capacity calculator.
//
// Given a bay volume (in blocks — same unit as the "5×5×15" satellite size
// limit on the booking form), works out roughly how many satellites of each
// known class would fit. This is a rough budget, not a bin-packing
// simulation: it just does volume / unit-volume, floored, per class.
//
// Loaded three ways in this project:
//   - admin.html          <script src="launchshare/capacity.js"> -> window.LaunchshareCapacity
//   - launchshare/index.html (public page) same as above
//   - discord-launch.js    require('../launchshare/capacity')    -> module.exports
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.LaunchshareCapacity = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {

  // Ordered largest -> smallest. Tweak volumes/labels here and every surface
  // (admin preview, Discord embeds, public schedule) picks it up.
  const CLASSES = [
    { key: 'observatory', label: 'giant observatory satellite (Hubble-class)', volume: 375 },
    { key: 'telecom',     label: 'large telecom / GPS satellite',              volume: 120 },
    { key: 'starlink',    label: 'Starlink-class small satellite',             volume: 40  },
    { key: 'cubesat',     label: 'cubesat',                                    volume: 8   },
  ];

  function breakdown(volume) {
    const v = Math.max(0, Number(volume) || 0);
    return CLASSES.map(c => ({
      key: c.key,
      label: c.label,
      unitVolume: c.volume,
      count: Math.floor(v / c.volume),
    }));
  }

  // Compact version for Discord embeds / admin previews: only classes that
  // actually fit at least one unit, capped to a handful of rows so the
  // embed/preview doesn't get noisy.
  function summaryRows(volume, max = 4) {
    return breakdown(volume).filter(c => c.count > 0).slice(0, max);
  }

  return { CLASSES, breakdown, summaryRows };
});

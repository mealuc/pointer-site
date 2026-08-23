/**
 * Two-language page switch.
 *
 * Every translatable node carries `data-t="key"`; English lives in the markup so the
 * page is correct before any script runs and stays correct if the script fails. The
 * choice is remembered per browser, and `localStorage` is wrapped because it throws
 * outright in some privacy modes rather than returning null.
 */
function applyLang(dict) {
  var KEY = 'pointer-lang';
  var button = document.getElementById('lang');

  function read() {
    try { return localStorage.getItem(KEY); } catch (e) { return null; }
  }

  function save(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* private mode */ }
  }

  function paint(lang) {
    var table = dict[lang] || {};
    var nodes = document.querySelectorAll('[data-t]');

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      var key = node.getAttribute('data-t');

      if (!node.dataset.en) node.dataset.en = node.innerHTML;

      node.innerHTML = lang === 'en' ? node.dataset.en : (table[key] || node.dataset.en);
    }

    document.documentElement.lang = lang;
    if (button) button.textContent = lang === 'en' ? 'Türkçe' : 'English';
    window.pointerLang = lang;
    document.dispatchEvent(new CustomEvent('langchange', { detail: lang }));
  }

  var stored = read();
  var initial = stored || ((navigator.language || 'en').slice(0, 2) === 'tr' ? 'tr' : 'en');
  paint(initial);

  if (button) {
    button.addEventListener('click', function () {
      var next = window.pointerLang === 'en' ? 'tr' : 'en';
      save(next);
      paint(next);
    });
  }
}

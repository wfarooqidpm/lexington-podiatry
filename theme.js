/* Light/dark switch. Light is the default; the visitor's choice is remembered. */
(function () {
  var root = document.documentElement;
  var KEY = 'lp-theme';
  function saved() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function apply(dark) {
    if (dark) root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
  }
  apply(saved() === 'dark');

  var MOON = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10Z"/></svg>';
  var SUN = '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19"/></svg>';

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    function label() {
      var dark = root.getAttribute('data-theme') === 'dark';
      var text = dark ? 'Light mode' : 'Dark mode';
      button.innerHTML = (dark ? SUN : MOON) + '<span>' + text + '</span>';
      button.title = text;
    }
    button.addEventListener('click', function () {
      var dark = root.getAttribute('data-theme') !== 'dark';
      apply(dark);
      try { localStorage.setItem(KEY, dark ? 'dark' : 'light'); } catch (e) {}
      label();
    });
    label();
    var bar = document.querySelector('header.nav .wrap');
    var simple = document.querySelector('body > header:not(.nav)');
    if (bar) bar.insertBefore(button, bar.querySelector('.menu-toggle, nav.links'));
    else if (simple && simple.lastElementChild) simple.insertBefore(button, simple.lastElementChild);
    else { button.classList.add('floating'); document.body.appendChild(button); }
    window.addEventListener('storage', function (e) {
      if (e.key === KEY) { apply(e.newValue === 'dark'); label(); }
    });
  });
})();

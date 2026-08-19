(() => {
  document.body.classList.add('utility-page');
  const head = document.head;
  if (!document.querySelector('link[data-utility-shell]')) {
    const stylesheet = document.createElement('link');
    stylesheet.rel = 'stylesheet';
    stylesheet.href = '/assets/utility-shell.css';
    stylesheet.dataset.utilityShell = 'true';
    head.append(stylesheet);
  }
  const nav = document.querySelector('nav .navlinks');
  if (nav) {
    nav.innerHTML = '<a href="/shop/">Shop</a><a href="/soft60/">Soft60</a><a href="/blog/">Journal</a><a href="/consult/">Advisory</a>';
  }
})();

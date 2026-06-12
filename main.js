/* ============================================================
   TECHNYAH — shared site scripts (all pages)
   Handles: mobile navigation, site search, AJAX form submission
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Mobile navigation ---------- */
  const hamburger = document.querySelector('.hamburger-menu');
  const navLinks = document.querySelector('.nav-links');
  if (hamburger && navLinks) {
    hamburger.addEventListener('click', () => {
      const open = navLinks.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close the menu when a link is chosen
    navLinks.querySelectorAll('a').forEach(a =>
      a.addEventListener('click', () => navLinks.classList.remove('active'))
    );
  }

  /* ---------- Site search (works on every page) ---------- */
  document.querySelectorAll('.search-bar').forEach(bar => {
    const dropdown = bar.parentElement.querySelector('.suggestions-dropdown');
    if (!dropdown) return;
    let searchIndex = [];
    fetch('searchIndex.json')
      .then(res => res.json())
      .then(data => { searchIndex = data; })
      .catch(() => { /* search degrades silently if index is missing */ });

    bar.addEventListener('input', function () {
      const query = this.value.trim().toLowerCase();
      dropdown.innerHTML = '';
      if (!query) { dropdown.style.display = 'none'; return; }
      const results = searchIndex.filter(entry =>
        (entry.content + ' ' + entry.title).toLowerCase().includes(query)
      );
      results.slice(0, 8).forEach(entry => {
        const item = document.createElement('div');
        item.className = 'suggestion-item';
        const link = document.createElement('a');
        link.href = entry.page;
        link.textContent = entry.title;
        item.appendChild(link);
        dropdown.appendChild(item);
      });
      dropdown.style.display = results.length ? 'block' : 'none';
    });

    document.addEventListener('click', e => {
      if (!bar.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.style.display = 'none';
      }
    });
  });

  /* ---------- AJAX submission for FormSubmit forms ----------
     Any <form data-formsubmit> posts in the background and shows
     an inline confirmation, so visitors never leave the page.
     Forms with file uploads (careers) post normally and land on
     thanks.html via the _next field instead.                    */
  document.querySelectorAll('form[data-formsubmit]').forEach(form => {
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      const original = btn.textContent;
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const res = await fetch(form.action.replace('formsubmit.co/', 'formsubmit.co/ajax/'), {
          method: 'POST',
          headers: { 'Accept': 'application/json' },
          body: new FormData(form)
        });
        if (!res.ok) throw new Error('Request failed');
        form.reset();
        btn.textContent = 'Sent — thank you. We will reply within one business day.';
        btn.style.background = 'var(--ok)';
        setTimeout(() => {
          btn.disabled = false;
          btn.textContent = original;
          btn.style.background = '';
        }, 6000);
      } catch (err) {
        btn.disabled = false;
        btn.textContent = original;
        alert('Your message could not be sent. Please email us directly at info@technyah.com.');
      }
    });
  });

});

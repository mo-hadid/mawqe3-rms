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

  /* ---------- Catalog rendering (products / services from CSV) ----------
     Pages keep static fallback cards in the HTML; if the CSV loads, it
     replaces them with the current catalog. Lets the team publish updates
     by editing a spreadsheet and exporting CSV — no code changes. */
  function parseCSV(text) {
    const rows = []; let row = [], field = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (q) {
        if (c === '"' && text[i+1] === '"') { field += '"'; i++; }
        else if (c === '"') q = false;
        else field += c;
      } else {
        if (c === '"') q = true;
        else if (c === ',') { row.push(field); field = ''; }
        else if (c === '\r') { /* skip */ }
        else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
        else field += c;
      }
    }
    if (field.length || row.length) { row.push(field); rows.push(row); }
    const head = rows.shift();
    return rows.filter(r => r.length > 1 && r[0]).map(r =>
      Object.fromEntries(head.map((h, i) => [h.trim(), (r[i] || '').trim()]))
    );
  }
  const esc = s => (s || '').replace(/[&<>"]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));

  const productGrid = document.querySelector('[data-catalog="products"]');
  if (productGrid) {
    fetch('products.csv').then(r => { if (!r.ok) throw 0; return r.text(); })
      .then(t => {
        const items = parseCSV(t);
        if (!items.length) return;
        productGrid.innerHTML = items.map(p => `
          <article class="product-card">
            <div class="product-media">
              <img src="images/${esc(p['Image File'])}" alt="${esc(p.Name)}" loading="lazy">
            </div>
            <div class="product-body">
              <span class="product-status">${esc(p.Status || 'Available')} — Quote Required</span>
              <h3>${esc(p.Name)}</h3>
              <p>${esc(p['Short Description'])}</p>
              <a href="quote.html" class="cta-btn" style="align-self:flex-start;">Request Pricing</a>
            </div>
          </article>`).join('');
      })
      .catch(() => { /* keep static fallback cards already in the HTML */ });
  }

  const serviceGrid = document.querySelector('[data-catalog="services"]');
  if (serviceGrid) {
    fetch('services.csv').then(r => { if (!r.ok) throw 0; return r.text(); })
      .then(t => {
        const items = parseCSV(t);
        if (!items.length) return;
        serviceGrid.innerHTML = items.map(s => `
          <div class="card">
            <img class="card-icon" src="images/graphics/${esc(s['Icon File'])}" alt="" loading="lazy">
            <p class="spec-label">Service / ${esc(s.Category)}</p>
            <h3>${esc(s.Name)}</h3>
            <p>${esc(s['Short Description'])}</p>
            ${s['Detail (expanded)'] ? `<button class="learn-more-btn" aria-expanded="false">Details</button>
            <div class="service-details"><p>${esc(s['Detail (expanded)'])}</p></div>` : ''}
          </div>`).join('');
        bindServiceToggles();
      })
      .catch(() => { bindServiceToggles(); });
  }

  function bindServiceToggles() {
    document.querySelectorAll('.learn-more-btn').forEach(btn => {
      if (btn.dataset.bound) return; btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const details = btn.nextElementSibling;
        const open = details.classList.toggle('open');
        btn.classList.toggle('open', open);
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
    });
  }
  window.bindServiceToggles = bindServiceToggles;

  /* ---------- Page-level filter search ----------
     <input class="page-filter" data-target=".selector"> live-filters
     the matching elements on the current page by their text content.
     Targets are re-queried each keystroke so async catalog cards work. */
  document.querySelectorAll('input.page-filter').forEach(input => {
    const empty = document.querySelector(input.dataset.empty || '.no-results');
    const apply = () => {
      const items = document.querySelectorAll(input.dataset.target);
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      items.forEach(el => {
        const match = !q || el.textContent.toLowerCase().includes(q);
        el.style.display = match ? '' : 'none';
        if (match) visible++;
      });
      if (empty) empty.style.display = visible ? 'none' : 'block';
    };
    input.addEventListener('input', apply);
  });

  /* ---------- Attachment preview + size guard (all forms) ----------
     FormSubmit's free tier caps total attachments at 10 MB per submission. */
  document.querySelectorAll('input[type="file"]').forEach(input => {
    input.addEventListener('change', e => {
      const preview = input.parentElement.querySelector('.file-preview');
      if (!preview) return;
      const file = e.target.files[0];
      if (!file) { preview.textContent = ''; return; }
      if (file.size > 10 * 1024 * 1024) {
        preview.style.color = 'var(--err)';
        preview.textContent = 'File is larger than 10 MB \u2014 please attach a smaller file.';
        input.value = '';
        return;
      }
      preview.style.color = 'var(--ok)';
      preview.textContent = 'Attached: ' + file.name + ' (' + (file.size / 1024).toFixed(0) + ' KB)';
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

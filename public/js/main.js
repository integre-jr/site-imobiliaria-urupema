/* ============================================================
   URUPEMA — Negócios Imobiliários · main.js
   ============================================================ */
(function () {
  'use strict';

  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  /* ---------- Header shadow on scroll ---------- */
  const header = $('.header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------- Mobile drawer ---------- */
  const drawer = $('.mobile-nav');
  const openBtn = $('#openMenu');
  const closeBtn = $('#closeMenu');
  const openDrawer = () => { if (drawer) { drawer.classList.add('is-open'); document.body.style.overflow = 'hidden'; } };
  const closeDrawer = () => { if (drawer) { drawer.classList.remove('is-open'); document.body.style.overflow = ''; } };
  openBtn && openBtn.addEventListener('click', openDrawer);
  closeBtn && closeBtn.addEventListener('click', closeDrawer);
  if (drawer) {
    $('.mobile-nav__scrim', drawer)?.addEventListener('click', closeDrawer);
    $$('.mobile-nav__links a', drawer).forEach(a => a.addEventListener('click', closeDrawer));
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

  /* ---------- Search bar tabs (Comprar / Alugar) ---------- */
  $$('.searchbar__tab').forEach(tab => {
    tab.addEventListener('click', () => {
      $$('.searchbar__tab').forEach(t => t.classList.remove('is-active'));
      tab.classList.add('is-active');
      const mode = tab.dataset.mode;
      const hidden = $('#searchMode');
      if (hidden) hidden.value = mode;
    });
  });

  /* ---------- Property filter chips ---------- */
  const chips = $$('.chip[data-filter]');
  const cards = $$('.property-card[data-type]');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      const f = chip.dataset.filter;
      cards.forEach(card => {
        const show = f === 'all' || card.dataset.type === f;
        card.style.display = show ? '' : 'none';
      });
    });
  });

  /* ---------- Favorites (localStorage) ---------- */
  const FAV_KEY = 'urupema:favs';
  const getFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } };
  const setFavs = (a) => localStorage.setItem(FAV_KEY, JSON.stringify(a));
  const updateFavCount = () => {
    const n = getFavs().length;
    $$('.fav-count').forEach(el => {
      el.textContent = n;
      el.classList.toggle('is-visible', n > 0);
    });
  };
  const syncFavButtons = () => {
    const favs = getFavs();
    $$('.card-fav[data-ref]').forEach(btn => {
      btn.classList.toggle('is-active', favs.includes(btn.dataset.ref));
    });
  };
  $$('.card-fav[data-ref]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const ref = btn.dataset.ref;
      let favs = getFavs();
      if (favs.includes(ref)) favs = favs.filter(r => r !== ref);
      else favs.push(ref);
      setFavs(favs);
      syncFavButtons();
      updateFavCount();
    });
  });
  updateFavCount();
  syncFavButtons();

  /* ---------- Image fallback (branded placeholder) ---------- */
  $$('.card-media img, .split__media img, .hero__bg img').forEach(img => {
    img.addEventListener('error', () => {
      const media = img.closest('.card-media, .split__media, .hero__bg');
      if (media) media.classList.add('is-fallback');
    });
    // handle cached-broken images
    if (img.complete && img.naturalWidth === 0) img.dispatchEvent(new Event('error'));
  });

  /* ---------- Scroll reveal ---------- */
  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(r => io.observe(r));
  } else {
    reveals.forEach(r => r.classList.add('is-in'));
  }

  /* ---------- Wizard (Financie) ---------- */
  const wizard = $('#wizard');
  if (wizard) {
    const panels = $$('.wizard__panel', wizard);
    const steps = $$('.wstep', wizard);
    let current = 0;

    const showStep = (i) => {
      panels.forEach((p, idx) => p.classList.toggle('is-active', idx === i));
      steps.forEach((s, idx) => {
        s.classList.toggle('is-active', idx === i);
        s.classList.toggle('is-done', idx < i);
      });
      current = i;
      wizard.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const validateStep = (i) => {
      const panel = panels[i];
      let ok = true;
      $$('[required]', panel).forEach(field => {
        if (!field.value.trim()) {
          field.style.borderColor = '#D1495B';
          ok = false;
        } else {
          field.style.borderColor = '';
        }
      });
      return ok;
    };

    $$('[data-next]', wizard).forEach(btn => {
      btn.addEventListener('click', () => {
        if (!validateStep(current)) return;
        if (current < panels.length - 1) showStep(current + 1);
      });
    });
    $$('[data-prev]', wizard).forEach(btn => {
      btn.addEventListener('click', () => { if (current > 0) showStep(current - 1); });
    });

    const wForm = $('#wizardForm');
    wForm && wForm.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!validateStep(current)) return;
      wizard.querySelector('.wizard__body')?.style && (wizard.querySelector('.wizard__body').style.display = 'none');
      $('.wizard__steps', wizard)?.style && ($('.wizard__steps', wizard).style.display = 'none');
      const success = $('#wizardSuccess');
      if (success) success.classList.add('is-visible');
    });
  }

  /* ---------- Generic form submit (fake success) ---------- */
  $$('form[data-mock]').forEach(form => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      let ok = true;
      $$('[required]', form).forEach(field => {
        if (!field.value.trim()) { field.style.borderColor = '#D1495B'; ok = false; }
        else field.style.borderColor = '';
      });
      if (!ok) {
        form.querySelector('[required]:invalid, [required]')?.focus();
        return;
      }
      const card = form.closest('.form-card') || form;
      const success = card.querySelector('.form-success');
      if (success) {
        form.style.display = 'none';
        success.classList.add('is-visible');
      } else {
        form.reset();
      }
    });
  });

  /* ---------- File dropzone label ---------- */
  $$('.dropzone').forEach(dz => {
    const input = $('input[type="file"]', dz);
    const label = $('.dropzone__count', dz);
    dz.addEventListener('click', () => input && input.click());
    input && input.addEventListener('change', () => {
      const n = input.files.length;
      if (label) label.textContent = n ? `${n} arquivo(s) selecionado(s)` : '';
    });
  });

  /* ---------- Quick reference search ---------- */
  $$('.ref-search, .mobile-nav__ref').forEach(box => {
    const input = $('input', box);
    const go = () => {
      const v = (input?.value || '').trim();
      if (v) window.location.href = `index.html#imoveis?ref=${encodeURIComponent(v)}`;
    };
    $('button', box)?.addEventListener('click', go);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  });

  /* ---------- Footer year ---------- */
  $$('.js-year').forEach(el => el.textContent = new Date().getFullYear());

})();

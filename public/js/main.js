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

  /* ---------- Property filter chips ----------
     Delegação de eventos: os cards da vitrine chegam depois, via js/imoveis.js. */
  const applyChips = (scope = document) => {
    const active = $('.chip.is-active[data-filter]', scope);
    const f = active ? active.dataset.filter : 'all';
    $$('.property-card[data-type]', scope).forEach(card => {
      card.style.display = (f === 'all' || card.dataset.type === f) ? '' : 'none';
    });
  };
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip[data-filter]');
    if (!chip) return;
    const scope = chip.closest('section') || document;
    $$('.chip[data-filter]', scope).forEach(c => c.classList.remove('is-active'));
    chip.classList.add('is-active');
    applyChips(scope);
  });

  /* ---------- Favorites (localStorage) ----------
     Botões: .card-fav[data-ref] (cards) e [data-fav-ref] (página do imóvel). */
  const FAV_KEY = 'urupema:favs';
  const getFavs = () => { try { return JSON.parse(localStorage.getItem(FAV_KEY)) || []; } catch { return []; } };
  const setFavs = (a) => { try { localStorage.setItem(FAV_KEY, JSON.stringify(a)); } catch { /* modo privado */ } };
  const favRef = (btn) => btn.dataset.ref || btn.dataset.favRef;
  const updateFavCount = () => {
    const n = getFavs().length;
    $$('.fav-count').forEach(el => {
      el.textContent = n;
      el.classList.toggle('is-visible', n > 0);
    });
  };
  const syncFavButtons = () => {
    const favs = getFavs();
    $$('.card-fav[data-ref], [data-fav-ref]').forEach(btn => {
      const on = favs.includes(favRef(btn));
      btn.classList.toggle('is-active', on);
      const label = $('span', btn);
      if (btn.hasAttribute('data-fav-ref') && label) label.textContent = on ? 'Nos seus favoritos' : 'Favoritar';
    });
    updateFavCount();
  };
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.card-fav[data-ref], [data-fav-ref]');
    if (!btn) return;
    e.preventDefault();
    const ref = favRef(btn);
    let favs = getFavs();
    if (favs.includes(ref)) favs = favs.filter(r => r !== ref);
    else favs.push(ref);
    setFavs(favs);
    syncFavButtons();
  });
  syncFavButtons();

  /* ---------- Image fallback (branded placeholder) ----------
     Captura no document: vale também para imagens inseridas depois. */
  const MEDIA = '.card-media, .split__media, .hero__bg';
  const fallback = (img) => {
    const media = img.closest(MEDIA);
    if (media) media.classList.add('is-fallback');
  };
  document.addEventListener('error', (e) => {
    if (e.target.tagName === 'IMG') fallback(e.target);
  }, true);
  const checkBroken = (scope = document) => {
    $$('.card-media img, .split__media img, .hero__bg img', scope).forEach(img => {
      if (img.complete && img.naturalWidth === 0 && img.getAttribute('src')) fallback(img);
    });
  };
  checkBroken();

  /* ---------- Scroll reveal ---------- */
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' })
    : null;
  const observeReveal = (scope = document) => {
    const els = scope.classList && scope.classList.contains('reveal') ? [scope] : $$('.reveal:not(.is-in)', scope);
    els.forEach(r => (io ? io.observe(r) : r.classList.add('is-in')));
  };
  observeReveal();

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

  /* ---------- Quick reference search ----------
     "1024", "ur1024" ou "UR-1024" → página do imóvel. No painel (/admin) continua no painel. */
  const adminPrefix = () => (document.documentElement.hasAttribute('data-admin') ? '/admin' : '');
  const normalizeRef = (v) => {
    const m = String(v || '').trim().toUpperCase().match(/^(?:UR)?-?\s*(\d{1,7})$/);
    return m ? 'UR-' + m[1] : null;
  };
  $$('.ref-search, .mobile-nav__ref').forEach(box => {
    const input = $('input', box);
    const go = () => {
      const v = (input?.value || '').trim();
      if (!v) return;
      const ref = normalizeRef(v);
      window.location.href = ref ? `${adminPrefix()}/imovel/${ref}` : `${adminPrefix()}/imoveis?ref=${encodeURIComponent(v)}`;
    };
    $('button', box)?.addEventListener('click', go);
    input?.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go(); } });
  });

  /* ---------- Footer year ---------- */
  $$('.js-year').forEach(el => el.textContent = new Date().getFullYear());

  /* ---------- API para js/imoveis.js (cards inseridos depois do carregamento) ---------- */
  window.Urupema = { syncFavs: syncFavButtons, getFavs, observeReveal, applyChips, checkBroken, normalizeRef, adminPrefix };

})();

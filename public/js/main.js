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

    $$('[data-next]', wizard).forEach(btn => {
      btn.addEventListener('click', () => {
        if (!validateFields(panels[current])) return;
        if (current < panels.length - 1) showStep(current + 1);
      });
    });
    $$('[data-prev]', wizard).forEach(btn => {
      btn.addEventListener('click', () => { if (current > 0) showStep(current - 1); });
    });
  }

  /* ---------- Formulários → leads (POST /api/leads) ----------
     form[data-lead="contato|negocie|financie|interesse_imovel"]. Campos com name; checkbox
     "consentimento" obrigatório (LGPD). Sucesso → mostra o .form-success irmão (ou #wizardSuccess). */
  function validateFields(scope) {
    let first = null;
    $$('[required]', scope).forEach(field => {
      const empty = field.type === 'checkbox' ? !field.checked : !field.value.trim();
      const bad = empty || (field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(field.value.trim()));
      const target = field.type === 'checkbox' ? field.closest('label') || field : field;
      target.classList.toggle('is-invalid', bad);
      if (bad && !first) first = field;
    });
    if (first) first.focus();
    return !first;
  }
  document.addEventListener('input', (e) => {
    const f = e.target;
    if (f.matches?.('[required]')) (f.type === 'checkbox' ? f.closest('label') || f : f).classList.remove('is-invalid');
  });

  const openedAt = Date.now();
  const whatsappLink = () => $('[data-cfg-href="contato.whatsapp"]')?.href || 'https://wa.me/5549991603030';

  // Fotos do Negocie: reduz no navegador (lado maior 1600 px, JPEG) antes de enviar.
  const MAX_LEAD_PHOTOS = 5;
  async function shrinkPhoto(file) {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * k);
    canvas.height = Math.round(bmp.height * k);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff';                       // PNG transparente: fundo branco no JPEG
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    bmp.close?.();
    for (const q of [0.82, 0.7, 0.55]) {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', q));
      if (blob && blob.size <= 1.9 * 1024 * 1024) return blob;
    }
    throw new Error('Foto grande demais.');
  }

  function showFormError(form, msg) {
    let box = $('.form-error', form);
    if (!box) {
      box = document.createElement('div');
      box.className = 'form-error';
      box.setAttribute('role', 'alert');
      (form.querySelector('.form-actions, .wizard__nav:last-of-type') || form.lastElementChild).before(box);
    }
    box.replaceChildren(msg + ' ');
    const a = document.createElement('a');
    a.href = whatsappLink();
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Se preferir, fale com a gente pelo WhatsApp.';
    box.append(a);
    box.hidden = false;
  }

  function showSuccess(form) {
    const wiz = form.closest('#wizard');
    if (wiz) {
      $('.wizard__body', wiz) && ($('.wizard__body', wiz).style.display = 'none');
      $('.wizard__steps', wiz) && ($('.wizard__steps', wiz).style.display = 'none');
      $('#wizardSuccess')?.classList.add('is-visible');
      return;
    }
    const success = $('.form-success', form.parentElement) || $('.form-success', form.closest('.form-card, section') || document);
    form.style.display = 'none';
    success?.classList.add('is-visible');
    success?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  $$('form[data-lead]').forEach(form => {
    // Campo-isca: invisível para pessoas; robôs costumam preencher.
    const trap = document.createElement('input');
    trap.type = 'text'; trap.name = 'website'; trap.tabIndex = -1; trap.autocomplete = 'off';
    trap.className = 'hp-field'; trap.setAttribute('aria-hidden', 'true');
    form.prepend(trap);
    const refInput = $('input[name="imovel_ref"]', form);
    if (refInput) refInput.value = $('main[data-imovel-ref]')?.dataset.imovelRef || '';

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!validateFields(form)) return;
      const btn = $('[type=submit]', form);
      const label = btn?.innerHTML;
      if (btn) { btn.disabled = true; btn.textContent = 'Enviando…'; }
      $('.form-error', form)?.setAttribute('hidden', '');
      try {
        const data = {};
        for (const el of form.elements) {
          if (!el.name || el.type === 'file' || ((el.type === 'radio') && !el.checked)) continue;
          data[el.name] = el.type === 'checkbox' ? el.checked : el.value;
        }
        data.origem = form.dataset.lead;
        data.t = Date.now() - openedAt;
        const fileInput = $('input[type="file"][name="fotos"]', form);
        const files = fileInput ? [...fileInput.files].filter(f => f.type.startsWith('image/')).slice(0, MAX_LEAD_PHOTOS) : [];
        let body;
        const headers = { 'X-Urupema': '1' };
        if (files.length) {
          body = new FormData();
          Object.entries(data).forEach(([k, v]) => body.append(k, String(v)));
          for (const f of files) {
            try { body.append('fotos', await shrinkPhoto(f), 'foto.jpg'); } catch { /* formato não suportado: segue sem ela */ }
          }
        } else {
          headers['Content-Type'] = 'application/json';
          body = JSON.stringify(data);
        }
        const res = await fetch('/api/leads', { method: 'POST', headers, body });
        const out = await res.json().catch(() => ({}));
        if (!res.ok) {
          showFormError(form, out.erro || 'Não foi possível enviar agora.');
          const field = out.campo && form.elements[out.campo];
          if (field && field.classList) { field.classList.add('is-invalid'); field.focus(); }
          return;
        }
        showSuccess(form);
      } catch {
        showFormError(form, 'Sem conexão no momento. Confira a internet e tente de novo.');
      } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = label; }
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
      const max = input.name === 'fotos' ? MAX_LEAD_PHOTOS : Infinity;
      if (label) label.textContent = !n ? '' : n > max ? `${n} fotos escolhidas: serão enviadas as ${max} primeiras` : `${n} foto(s) selecionada(s)`;
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

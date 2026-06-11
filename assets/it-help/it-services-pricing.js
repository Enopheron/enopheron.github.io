/* ═══════════════════════════════════════════════════
   IT-Konsulent Vladimir — prisliste.js
   ═══════════════════════════════════════════════════ */

const FORMSPREE_ID  = 'mnjgqoyj';
const FJERNSTYRING  = 'Fjernstyring / Rask hjelp';
const OPPMOTE_KEY   = 'Hos deg';
const RABATT_KEY    = 'Student- / pensjonistrabatt';

let cart           = [];
let extras         = {};   // { key: { name, price, active } }
let deliveryInited = false;

/* ── Helpers ────────────────────────────────────────── */
const $ = id => document.getElementById(id);

function cartBase()    { return cart.reduce((s, i) => s + i.price, 0); }
function extrasTotal() { return Object.values(extras).filter(e => e.active).reduce((s, e) => s + e.price, 0); }
function grandTotal()  { return cartBase() + extrasTotal(); }

function fmt(n) { return n.toLocaleString('nb-NO') + ',– NOK'; }

/* ── Event delegation ───────────────────────────────── */
document.addEventListener('click', function(e) {
  const btnAdd    = e.target.closest('.btn-add');
  const btnExtra  = e.target.closest('.btn-extra');
  const btnRemove = e.target.closest('.cart-item-remove');
  const trigger   = e.target.closest('.svc-trigger');

  if (btnAdd)    { e.stopPropagation(); handleAddToCart(btnAdd);       return; }
  if (btnExtra)  { e.stopPropagation(); handleExtra(btnExtra);         return; }
  if (btnRemove) { removeFromCart(btnRemove.dataset.name);             return; }
  if (trigger)   { const card = trigger.closest('.svc'); if (card) toggleSvc(card); return; }

  if (e.target.closest('#cartFab'))        { openCart();              return; }
  if (e.target.id === 'cartOverlay')       { closeCart();             return; }
  if (e.target.closest('.cp-close'))       { closeCart();             return; }
  if (e.target.closest('#btnSubmit'))      { submitOrder();           return; }
  if (e.target.closest('.btn-close-ticket')) { closeCart(); resetCart(); return; }
});

/* ── Accordion ──────────────────────────────────────── */
function toggleSvc(card) {
  const body   = card.querySelector('.svc-body');
  const isOpen = card.classList.contains('open');
  card.classList.toggle('open', !isOpen);
  body.style.maxHeight = isOpen ? '0' : body.scrollHeight + 'px';
}

/* ── Cart actions ───────────────────────────────────── */
function handleAddToCart(btn) {
  const card  = btn.closest('.svc');
  const name  = card.dataset.name;
  const price = parseInt(card.dataset.price);
  const idx   = cart.findIndex(i => i.name === name);

  if (idx !== -1) {
    cart.splice(idx, 1);
    btn.textContent = '+ Legg til';
    btn.classList.remove('added');
    card.classList.remove('in-cart');
  } else {
    cart.push({ name, price });
    btn.textContent = '✓ Lagt til';
    btn.classList.add('added');
    card.classList.add('in-cart');
  }
  renderCart();
  updateFab();
}

function removeFromCart(name) {
  if (!name) return;
  cart = cart.filter(i => i.name !== name);
  document.querySelectorAll(`.svc[data-name="${name}"]`).forEach(card => {
    card.classList.remove('in-cart');
    const btn = card.querySelector('.btn-add');
    if (btn) { btn.textContent = '+ Legg til'; btn.classList.remove('added'); }
  });
  renderCart();
  updateFab();
}

/* ── Render cart ────────────────────────────────────── */
function renderCart() {
  const container = $('cartItems');
  const emptyMsg  = $('cartEmpty');
  const totalRow  = $('cartTotal');
  const totalEl   = $('cartTotalPrice');
  const divider   = $('cpDivider');
  const form      = $('orderForm');
  const footer    = $('cpFooter');
  const extrasEl  = $('cartExtras');

  // Clear previous items
  container.querySelectorAll('.cart-item').forEach(el => el.remove());

  if (cart.length === 0) {
    emptyMsg.style.display = 'block';
    [totalRow, divider, form, footer].forEach(el => el.style.display = 'none');
    if (extrasEl) extrasEl.style.display = 'none';
    return;
  }

  emptyMsg.style.display    = 'none';
  totalRow.style.display    = 'flex';
  if (extrasEl) extrasEl.style.display = 'block';
  [divider, form, footer].forEach(el => el.style.display = 'block');

  initDelivery();
  updateDiscountAmount();

  // Render items
  cart.forEach(item => {
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML =
      `<span class="cart-item-name">${item.name}</span>` +
      `<span class="cart-item-price">${item.price.toLocaleString('nb-NO')},–</span>` +
      `<button class="cart-item-remove" data-name="${item.name}"><i class="bi bi-x"></i></button>`;
    container.appendChild(el);
  });

  totalEl.textContent = fmt(grandTotal());
}

function updateFab() {
  const fab = $('cartFab');
  $('cartCount').textContent      = cart.length;
  $('cartFabLabel').textContent   = cart.length > 0 ? `Bestilling (${cart.length})` : 'Bestilling';
  fab.classList.toggle('visible', cart.length > 0);
}

/* ── Panel ──────────────────────────────────────────── */
function openCart() {
  $('cartPanel').classList.add('open');
  $('cartOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}
function closeCart() {
  $('cartPanel').classList.remove('open');
  $('cartOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}

/* ── Extras (discount) ──────────────────────────────── */
function handleExtra(btn) {
  const name = btn.dataset.extraName;
  if (extras[name]?.active) {
    extras[name].active = false;
    btn.textContent = '+ Legg til';
    btn.classList.remove('added');
  } else {
    const price = name === RABATT_KEY ? calcDiscount() : parseInt(btn.dataset.extraPrice);
    extras[name] = { name, price, active: true };
    btn.textContent = '✓ Lagt til';
    btn.classList.add('added');
  }
  $('cartTotalPrice').textContent = fmt(grandTotal());
}

/* ── Delivery ───────────────────────────────────────── */
function initDelivery() {
  const radios = document.querySelectorAll('input[name="delivery"]');
  if (!radios.length) return;

  // Auto-select remote if Fjernstyring is in cart
  if (cart.some(i => i.name === FJERNSTYRING)) {
    const r = document.querySelector('input[name="delivery"][value="remote"]');
    if (r && !r.checked) r.checked = true;
  }

  if (!deliveryInited) {
    radios.forEach(r => r.addEventListener('change', onDeliveryChange));
    deliveryInited = true;
  }
  onDeliveryChange();
}

function onDeliveryChange() {
  const val      = document.querySelector('input[name="delivery"]:checked')?.value;
  const addrEl   = $('addressField');
  const isClient = val === 'client';

  if (addrEl) addrEl.style.display = isClient ? 'block' : 'none';

  // Oppmøte as an extra — consistent with other extras
  if (isClient) {
    extras[OPPMOTE_KEY] = { name: OPPMOTE_KEY, price: 350, active: true };
  } else {
    delete extras[OPPMOTE_KEY];
  }

  const totalEl = $('cartTotalPrice');
  if (totalEl) totalEl.textContent = fmt(grandTotal());
}

function getDeliveryLabel() {
  const val = document.querySelector('input[name="delivery"]:checked')?.value;
  if (val === 'remote') return 'Fjerntilkobling (AnyDesk)';
  if (val === 'client') return 'Hos deg (+350,-)';
  if (val === 'me')     return 'Hos meg (adresse sendes etter avtale)';
  return '—';
}

/* ── Discount ───────────────────────────────────────── */
function calcDiscount() {
  return -Math.round(cartBase() * 0.15);
}

function updateDiscountAmount() {
  const el = $('discountAmount');
  if (!el) return;
  const disc = calcDiscount();
  el.textContent = disc.toLocaleString('nb-NO') + ',–';
  if (extras[RABATT_KEY]?.active) {
    extras[RABATT_KEY].price = disc;
  }
}

/* ── Submit ─────────────────────────────────────────── */
function genTicket() {
  return 'ORD-' + Date.now().toString().slice(-6) + '-' +
    Math.random().toString(36).substring(2, 5).toUpperCase();
}

async function submitOrder() {
  const name    = $('fieldName').value.trim();
  const email   = $('fieldEmail').value.trim();
  const phone   = $('fieldPhone').value.trim();
  const desc    = $('fieldDesc').value.trim();
  const address = $('fieldAddress')?.value.trim() || '';
  const val     = document.querySelector('input[name="delivery"]:checked')?.value;

  if (!name || !email)              { alert('Vennligst fyll inn navn og e-post.'); return; }
  if (!cart.length)                 { alert('Legg til minst en tjeneste.'); return; }
  if (!val) {
    alert('Vennligst velg hvordan du ønsker hjelpen (fjerntilkobling, hos deg eller hos meg).');
    document.getElementById('deliveryOptions')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  if (val === 'client' && !address) { alert('Vennligst fyll inn adressen din.'); return; }

  const btn = $('btnSubmit');
  btn.disabled  = true;
  btn.innerHTML = '<i class="bi bi-hourglass-split"></i> Sender...';

  const ticketId = genTicket();
  const total    = grandTotal();   // ← now includes extras (oppmøte, discount)
  const allItems = [...cart, ...Object.values(extras).filter(e => e.active)];
  const services = allItems.map(i => `${i.name}: ${i.price.toLocaleString('nb-NO')},– NOK`).join('\n');

  const payload = {
    _subject:      `Ny bestilling ${ticketId} fra ${name}`,
    Ordrenummer:   ticketId,
    Navn:          name,
    Epost:         email,
    Telefon:       phone   || '—',
    Oppmøtemetode: getDeliveryLabel(),
    Adresse:       address || '—',
    Tjenester:     services,
    Total:         fmt(total),
    Beskrivelse:   desc    || '—',
  };

  try {
    const res = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error();
    showTicket(ticketId, total);
  } catch {
    const body =
      `Ordrenummer: ${ticketId}\nNavn: ${name}\nEpost: ${email}\n` +
      `Telefon: ${phone || '—'}\nOppmøtemetode: ${getDeliveryLabel()}\n` +
      (address ? `Adresse: ${address}\n` : '') +
      `\nTjenester:\n${services}\n\nTotal: ${fmt(total)}\n\nBeskrivelse: ${desc || '—'}`;
    window.location.href =
      `mailto:enopheron@outlook.com?subject=Ny%20bestilling%20${encodeURIComponent(ticketId)}&body=${encodeURIComponent(body)}`;
    btn.disabled  = false;
    btn.innerHTML = '<i class="bi bi-send"></i> Send bestilling';
  }
}

function showTicket(ticketId, total) {
  $('cpBody').style.display   = 'none';
  $('cpFooter').style.display = 'none';
  $('ticketNum').textContent  = ticketId;

  const allItems = [...cart, ...Object.values(extras).filter(e => e.active)];
  $('ticketServices').innerHTML =
    '<div class="ticket-services-title">Tjenester inkludert</div>' +
    allItems.map(i =>
      `<div class="ticket-svc-item"><span>${i.name}</span><span>${i.price.toLocaleString('nb-NO')},–</span></div>`
    ).join('') +
    `<div class="ticket-total"><span>Total</span><span>${fmt(total)}</span></div>`;

  $('ticketScreen').classList.add('show');
}

function resetCart() {
  cart           = [];
  extras         = {};
  deliveryInited = false;

  document.querySelectorAll('.btn-extra').forEach(b => {
    b.textContent = '+ Legg til';
    b.classList.remove('added');
  });
  document.querySelectorAll('.svc.in-cart').forEach(c => {
    c.classList.remove('in-cart');
    const b = c.querySelector('.btn-add');
    if (b) { b.textContent = '+ Legg til'; b.classList.remove('added'); }
  });
  ['fieldName', 'fieldEmail', 'fieldPhone', 'fieldDesc'].forEach(id => {
    const el = $(id);
    if (el) el.value = '';
  });

  $('cpBody').style.display   = '';
  $('cpFooter').style.display = 'none';
  $('ticketScreen').classList.remove('show');
  renderCart();
  updateFab();
}

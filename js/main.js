const WHATSAPP_NUMBER = '558894473872';

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const formatPrice = (value) => value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
});

/* Header e barra de progresso */

const header = document.querySelector('.header');
const progressBar = document.querySelector('.progress-bar');

function handleScroll() {
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    const progress = maxScroll > 0 ? window.scrollY / maxScroll : 0;

    header.classList.toggle('is-scrolled', window.scrollY > 40);
    progressBar.style.transform = `scaleX(${progress})`;
}

window.addEventListener('scroll', handleScroll, { passive: true });
handleScroll();

/* Menu mobile */

const menuToggle = document.getElementById('menuToggle');
const navMenu = document.getElementById('navMenu');
const mobileNav = window.matchMedia('(max-width: 900px)');

const isMenuOpen = () => menuToggle.getAttribute('aria-expanded') === 'true';

function setMenu(open, { returnFocus = false } = {}) {
    menuToggle.setAttribute('aria-expanded', String(open));
    navMenu.classList.toggle('is-open', open);

    if (open) navMenu.querySelector('a')?.focus();
    else if (returnFocus) menuToggle.focus();
}

menuToggle.addEventListener('click', () => setMenu(!isMenuOpen()));

navMenu.addEventListener('click', (event) => {
    if (event.target.closest('a')) setMenu(false);
});

document.addEventListener('click', (event) => {
    if (isMenuOpen() && !event.target.closest('.nav')) setMenu(false);
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isMenuOpen()) setMenu(false, { returnFocus: true });
});

mobileNav.addEventListener('change', () => setMenu(false));

/* Animações */

function initAnimations() {
    if (!window.gsap || reduceMotion) return;

    gsap.registerPlugin(ScrollTrigger);

    const ease = 'power4.out';

    gsap.from('.tag', { opacity: 0, y: 40, duration: 1, ease });
    gsap.from('.hero h1', { opacity: 0, y: 90, duration: 1.4, delay: .2, ease });
    gsap.from('.hero-text', { opacity: 0, y: 40, duration: 1.2, delay: .45, ease });
    gsap.from('.hero-buttons .btn', { opacity: 0, y: 30, duration: 1, stagger: .15, delay: .6, ease });

    // Anima o conteúdo, não a <section>: transformar a seção desloca o destino dos links do menu.
    gsap.utils.toArray('.section-top, .about').forEach((block) => {
        gsap.from(block, {
            opacity: 0,
            y: 100,
            duration: 1.2,
            ease,
            scrollTrigger: { trigger: block, start: 'top 85%' },
        });
    });

    const staggerIn = (selector, vars, step) => {
        gsap.utils.toArray(selector).forEach((item, i) => {
            gsap.from(item, {
                opacity: 0,
                duration: 1,
                delay: i * step,
                ease,
                ...vars,
                scrollTrigger: { trigger: item, start: 'top 90%' },
            });
        });
    };

    staggerIn('.card', { y: 80, scale: .95 }, .1);
    staggerIn('.team-card', { y: 60 }, .08);

    const parallax = (selector, y) => gsap.to(selector, {
        y,
        ease: 'none',
        scrollTrigger: { trigger: 'body', scrub: 1 },
    });

    parallax('.logo-watermark', -80);
    parallax('.bg-gradient', -120);
}

initAnimations();

/* Galeria dos produtos (setas + swipe no celular) */

document.querySelectorAll('.card').forEach((card) => {
    const gallery = card.querySelector('.gallery');
    const images = gallery.querySelectorAll('img');
    let current = 0;
    let touchStartX = null;

    if (images.length < 2) {
        gallery.querySelector('.switch')?.remove();
        return;
    }

    const show = (index) => {
        images[current].classList.remove('active');
        current = (index + images.length) % images.length;
        images[current].classList.add('active');
    };

    card.querySelector('.prev').addEventListener('click', () => show(current - 1));
    card.querySelector('.next').addEventListener('click', () => show(current + 1));

    gallery.addEventListener('touchstart', (event) => {
        touchStartX = event.touches[0].clientX;
    }, { passive: true });

    gallery.addEventListener('touchend', (event) => {
        if (touchStartX === null) return;

        const deltaX = event.changedTouches[0].clientX - touchStartX;
        if (Math.abs(deltaX) > 40) show(current + (deltaX < 0 ? 1 : -1));
        touchStartX = null;
    });
});

/* Carrinho */

const modal = document.getElementById('modal');
const closeModalBtn = document.getElementById('closeModal');
const viewProduct = document.getElementById('viewProduct');
const viewCart = document.getElementById('viewCart');
const modalName = document.getElementById('modalName');
const fitGroup = document.getElementById('fitGroup');
const addToCartBtn = document.getElementById('addToCartBtn');

const cartBar = document.getElementById('cartBar');
const cartBarCount = document.getElementById('cartBarCount');
const cartBarTotal = document.getElementById('cartBarTotal');
const navCartCount = document.getElementById('navCartCount');

const cartItems = document.getElementById('cartItems');
const cartItemTemplate = document.getElementById('cartItemTemplate');
const cartModalTotal = document.getElementById('cartModalTotal');
const clientNameInput = document.getElementById('clientName');
const nameError = document.getElementById('nameError');
const paymentBreakdown = document.getElementById('paymentBreakdown');
const breakdownNow = document.getElementById('breakdownNow');
const breakdownLater = document.getElementById('breakdownLater');
const finishBtn = document.getElementById('finishBtn');

const pageContent = [header, document.querySelector('main'), document.querySelector('.footer'), cartBar];

const CART_STORAGE_KEY = 'caderun-cart';

// localStorage pode estar indisponível (modo privado, cookies bloqueados): o carrinho só não é salvo.
function loadCart() {
    try {
        const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY));
        if (!Array.isArray(saved)) return [];

        return saved.filter((item) => item && typeof item.name === 'string'
            && typeof item.size === 'string' && Number.isFinite(item.price));
    } catch {
        return [];
    }
}

function saveCart() {
    try {
        localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
        // Sem armazenamento disponível; o carrinho continua funcionando só nesta visita.
    }
}

let cart = loadCart().map((item, index) => ({ ...item, id: index + 1 }));
let nextItemId = cart.length + 1;
let selectedProduct = null;
let lastFocused = null;

const getCartTotal = () => cart.reduce((sum, item) => sum + item.price, 0);
const getChecked = (name) => document.querySelector(`input[name="${name}"]:checked`).value;

function renderCart() {
    const total = getCartTotal();

    navCartCount.textContent = cart.length;
    cartBarCount.textContent = cart.length;
    cartBarTotal.textContent = formatPrice(total);
    cartModalTotal.textContent = formatPrice(total);
    cartBar.classList.toggle('is-visible', cart.length > 0);
    finishBtn.disabled = cart.length === 0;
    saveCart();

    if (cart.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'cart-empty-msg';
        empty.textContent = 'Seu carrinho está vazio.';
        cartItems.replaceChildren(empty);
    } else {
        cartItems.replaceChildren(...cart.map(renderCartItem));
    }

    renderPaymentBreakdown();
}

function renderCartItem(item) {
    const row = cartItemTemplate.content.firstElementChild.cloneNode(true);

    row.dataset.id = item.id;
    row.querySelector('.cart-item-name').textContent = item.name;
    row.querySelector('.cart-item-meta').textContent = [item.fit, `TAM ${item.size}`].filter(Boolean).join(' • ');
    row.querySelector('.cart-item-price').textContent = formatPrice(item.price);
    row.querySelector('.cart-item-remove').setAttribute('aria-label', `Remover ${item.name} do carrinho`);

    return row;
}

function renderPaymentBreakdown() {
    const half = formatPrice(getCartTotal() / 2);

    paymentBreakdown.hidden = getChecked('pay') !== 'entrada';
    breakdownNow.textContent = half;
    breakdownLater.textContent = half;
}

function openModal(view) {
    const isCart = view === 'cart';

    viewProduct.hidden = isCart;
    viewCart.hidden = !isCart;
    modal.setAttribute('aria-labelledby', isCart ? 'cartTitle' : 'modalName');

    if (isMenuOpen()) setMenu(false);

    lastFocused = document.activeElement;
    modal.classList.add('is-open');
    document.body.classList.add('no-scroll');
    pageContent.forEach((element) => { element.inert = true; });

    closeModalBtn.focus();
}

function closeModal() {
    modal.classList.remove('is-open');
    document.body.classList.remove('no-scroll');
    pageContent.forEach((element) => { element.inert = false; });

    lastFocused?.focus({ preventScroll: true });
}

document.querySelectorAll('.buy').forEach((button) => {
    button.addEventListener('click', () => {
        selectedProduct = {
            name: button.dataset.name,
            price: Number(button.dataset.price),
            singleFit: button.hasAttribute('data-single-fit'),
        };

        modalName.textContent = selectedProduct.name;
        fitGroup.hidden = selectedProduct.singleFit;
        openModal('product');
    });
});

addToCartBtn.addEventListener('click', () => {
    if (!selectedProduct) return;

    cart.push({
        id: nextItemId++,
        name: selectedProduct.name,
        price: selectedProduct.price,
        size: getChecked('size'),
        fit: selectedProduct.singleFit ? '' : getChecked('fit'),
    });

    renderCart();
    closeModal();
});

cartItems.addEventListener('click', (event) => {
    const removeBtn = event.target.closest('.cart-item-remove');
    if (!removeBtn) return;

    const id = Number(removeBtn.closest('.cart-item').dataset.id);
    cart = cart.filter((item) => item.id !== id);
    renderCart();

    (cartItems.querySelector('.cart-item-remove') ?? closeModalBtn).focus();
});

document.querySelectorAll('input[name="pay"]').forEach((radio) => {
    radio.addEventListener('change', renderPaymentBreakdown);
});

document.getElementById('openCartNav').addEventListener('click', () => openModal('cart'));
document.getElementById('cartBarBtn').addEventListener('click', () => openModal('cart'));

closeModalBtn.addEventListener('click', closeModal);

modal.addEventListener('click', (event) => {
    if (event.target === modal) closeModal();
});

document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
});

/* Pedido pelo WhatsApp */

const isFullName = (name) => name.split(' ').filter((part) => part.length >= 2).length >= 2;

function buildOrderMessage(name, payment) {
    const total = getCartTotal();
    const half = formatPrice(total / 2);
    const divider = '━━━━━━━━━━━━━━━━━━';

    const lines = [
        '🔥 *NOVO PEDIDO — CADÊ RUN?* 🔥',
        '',
        `👤 *Cliente:* ${name}`,
        divider,
        '',
    ];

    cart.forEach((item, index) => {
        lines.push(`*${index + 1}. ${item.name}*`);
        if (item.fit) lines.push(`• Modelagem: ${item.fit}`);
        lines.push(`• Tamanho: ${item.size}`, `• Preço: ${formatPrice(item.price)}`, '');
    });

    lines.push(divider);

    if (payment === 'entrada') {
        lines.push(
            '💳 *Pagamento:* 50% PIX Agora + 50% Depois',
            '',
            `💰 *Pagamento Agora (PIX):* ${half}`,
            `💰 *Pagamento Depois:* ${half}`,
            '',
            '📲 Enviaremos a chave PIX para pagamento da entrada.',
        );
    } else if (payment === 'cartao') {
        lines.push(
            '💳 *Pagamento:* Cartão',
            `💰 *Total:* ${formatPrice(total)}`,
            '',
            '📲 Enviaremos o link de pagamento para o cartão.',
        );
    } else {
        lines.push(
            '💳 *Pagamento:* PIX',
            `💰 *Total:* ${formatPrice(total)}`,
            '',
            '📲 Enviaremos a chave PIX para pagamento.',
        );
    }

    return lines.join('\n');
}

clientNameInput.addEventListener('input', () => {
    nameError.textContent = '';
    clientNameInput.removeAttribute('aria-invalid');
});

finishBtn.addEventListener('click', () => {
    if (cart.length === 0) return;

    const name = clientNameInput.value.trim().replace(/\s+/g, ' ');

    if (!isFullName(name)) {
        nameError.textContent = 'Digite seu nome completo (nome e sobrenome).';
        clientNameInput.setAttribute('aria-invalid', 'true');
        clientNameInput.focus();
        return;
    }

    const message = buildOrderMessage(name, getChecked('pay'));
    window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`, '_blank');
});

renderCart();

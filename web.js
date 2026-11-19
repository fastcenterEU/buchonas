// Buchona's Beauty Salon · interacción de la web
(() => {
  'use strict';

  // Menú en móvil
  const boton = document.querySelector('[data-abrir-menu]');
  const menu = document.querySelector('[data-menu-movil]');
  if (boton && menu) {
    const fijar = (abierto) => {
      boton.setAttribute('aria-expanded', String(abierto));
      boton.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      menu.hidden = !abierto;
    };
    boton.addEventListener('click', () => fijar(menu.hidden));
    menu.addEventListener('click', (e) => { if (e.target.closest('a')) fijar(false); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { fijar(false); boton.focus(); } });
    document.addEventListener('click', (e) => { if (!menu.hidden && !menu.contains(e.target) && !boton.contains(e.target)) fijar(false); });
  }

  // Comparadores de antes y después
  document.querySelectorAll('[data-comparar]').forEach((caja) => {
    const control = caja.querySelector('input[type="range"]');
    const mover = () => caja.style.setProperty('--corte', control.value + '%');
    control.addEventListener('input', mover);
    mover();
  });

  // Año en el pie
  document.querySelectorAll('[data-anio]').forEach((el) => { el.textContent = new Date().getFullYear(); });
})();

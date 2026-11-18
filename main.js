(() => {
  'use strict';
  document.documentElement.classList.add('js');
  const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const menu = document.querySelector('[data-menu]');
  if (menu) {
    const cerrarMenu = () => { menu.open = false; };
    menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', cerrarMenu));
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menu.open) {
        cerrarMenu();
        menu.querySelector('summary').focus();
      }
    });
    document.addEventListener('click', (e) => {
      if (menu.open && !menu.contains(e.target)) cerrarMenu();
    });
  }
  document.querySelectorAll('[data-tira]').forEach((tira) => {
    tira.addEventListener('focusin', (e) => {
      const pieza = e.target.closest('li');
      if (!pieza || getComputedStyle(tira).overflowX === 'visible') return;
      const margen = parseFloat(getComputedStyle(tira).scrollPaddingLeft) || 0;
      const desplazar = pieza.getBoundingClientRect().left - tira.getBoundingClientRect().left - margen;
      tira.scrollBy({ left: desplazar, behavior: sinMovimiento ? 'auto' : 'smooth' });
    });
  });
  const visor = document.querySelector('[data-visor-dialogo]');
  const enlaces = [...document.querySelectorAll('[data-visor]')];
  if (visor && enlaces.length && typeof visor.showModal === 'function') {
    const figura = visor.querySelector('.visor__figura');
    const contador = visor.querySelector('.visor__contador');
    const foto = document.createElement('img');
    foto.className = 'visor__foto';
    foto.draggable = false;
    let actual = 0;
    let origen = null;
    let grupo = enlaces;
    const mostrar = (i) => {
      if (!foto.isConnected) figura.prepend(foto);
      actual = (i + grupo.length) % grupo.length;
      const enlace = grupo[actual];
      const miniatura = enlace.querySelector('img');
      foto.width = Number(enlace.dataset.ancho);
      foto.height = Number(enlace.dataset.alto);
      foto.src = enlace.getAttribute('href');
      foto.alt = miniatura.alt;
      contador.textContent = `${actual + 1} / ${grupo.length}`;
    };
    enlaces.forEach((enlace) => {
      enlace.addEventListener('click', (e) => {
        e.preventDefault();
        origen = enlace;
        const contenedor = enlace.closest('[data-visor-grupo]');
        grupo = (contenedor ? [...contenedor.querySelectorAll('[data-visor]')] : enlaces).filter((a) => !a.closest('[hidden]'));
        mostrar(grupo.indexOf(enlace));
        visor.showModal();
      });
    });
    visor.querySelector('[data-cerrar]').addEventListener('click', () => visor.close());
    visor.querySelector('[data-anterior]').addEventListener('click', () => mostrar(actual - 1));
    visor.querySelector('[data-siguiente]').addEventListener('click', () => mostrar(actual + 1));
    visor.addEventListener('click', (e) => { if (e.target === visor || e.target === figura) visor.close(); });
    visor.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') mostrar(actual - 1);
      if (e.key === 'ArrowRight') mostrar(actual + 1);
    });
    visor.addEventListener('close', () => origen?.focus());
    let x0 = null;
    let dx = 0;
    figura.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || e.target !== foto) return;
      x0 = e.clientX;
      dx = 0;
      foto.style.transition = 'none';
      figura.setPointerCapture(e.pointerId);
    });
    figura.addEventListener('pointermove', (e) => {
      if (x0 === null) return;
      dx = e.clientX - x0;
      foto.style.transform = `translateX(${dx}px)`;
    });
    const soltarFoto = () => {
      if (x0 === null) return;
      x0 = null;
      foto.style.transition = '';
      foto.style.transform = '';
      if (Math.abs(dx) > 60) mostrar(actual + (dx < 0 ? 1 : -1));
    };
    figura.addEventListener('pointerup', soltarFoto);
    figura.addEventListener('pointercancel', soltarFoto);
  }
  document.querySelectorAll('[data-carrusel]').forEach((carrusel) => {
    const lista = carrusel.querySelector('[data-tira]');
    const flechas = carrusel.querySelector('[data-flechas]');
    if (!lista || !flechas) return;
    const [anterior, siguiente] = flechas.querySelectorAll('button');
    const paso = () => (lista.querySelector(':scope > li:not([hidden])') || lista.firstElementChild).getBoundingClientRect().width + (parseFloat(getComputedStyle(lista).columnGap) || 0);
    const mover = (sentido) => {
      const p = paso();
      lista.scrollBy({ left: sentido * p * Math.max(1, Math.floor((lista.clientWidth + 16) / p)), behavior: sinMovimiento ? 'auto' : 'smooth' });
    };
    const estado = () => {
      anterior.disabled = lista.scrollLeft < 8;
      siguiente.disabled = lista.scrollLeft > lista.scrollWidth - lista.clientWidth - 8;
    };
    anterior.addEventListener('click', () => mover(-1));
    siguiente.addEventListener('click', () => mover(1));
    lista.addEventListener('scroll', estado, { passive: true });
    addEventListener('resize', estado);
    flechas.hidden = false;
    estado();
  });
  const video = document.querySelector('[data-video]');
  if (video) {
    const lista = (video.dataset.lista || '').split(',').map((s) => s.trim()).filter(Boolean);
    const boton = video.parentElement.querySelector('[data-video-play]');
    const animacion = video.dataset.animacion;
    let conAnimacion = false;          // se ha puesto la imagen animada en lugar del vídeo
    const videos = [video];
    let activo = video;
    let aLaVista = true;
    let parado = sinMovimiento;        // no debe arrancar hasta que la persona lo pida
    let necesitaToque = sinMovimiento; // enseña el botón de reproducir
    const pintarBoton = () => { if (boton) boton.hidden = !necesitaToque; };
    const ponerAnimacion = () => {
      if (conAnimacion) return;
      conAnimacion = true;
      const [ancho, alto] = (video.dataset.animacionMedidas || '').split('x').map(Number);
      const imagen = new Image();
      imagen.className = 'portada__animacion';
      imagen.alt = '';
      if (ancho && alto) { imagen.width = ancho; imagen.height = alto; }
      imagen.src = animacion;
      video.parentElement.append(imagen);
      videos.forEach((v) => v.pause());
    };
    const reproducir = () => {
      if (!aLaVista || parado || conAnimacion) return;
      const promesa = activo.play();
      if (promesa && promesa.catch) {
        promesa.catch((error) => {
          if (!error || error.name !== 'NotAllowedError') return;
          if (animacion && !sinMovimiento) ponerAnimacion();
          else { necesitaToque = true; pintarBoton(); }
        });
      }
    };
    video.controls = false;
    if (sinMovimiento) {
      video.removeAttribute('autoplay');
      video.pause();
    }
    if (lista.length > 1) {
      let reserva = video.cloneNode(false);
      let turno = 0;
      ['autoplay', 'poster', 'data-video', 'data-lista', 'aria-label', 'loop'].forEach((a) => reserva.removeAttribute(a));
      reserva.setAttribute('aria-hidden', 'true');
      reserva.muted = true;
      reserva.preload = 'auto';
      reserva.className = 'en-reserva';
      reserva.src = lista[1];
      video.loop = false;
      video.after(reserva);
      videos.push(reserva);
      const alTerminar = (e) => {
        if (e.target !== activo) return;
        turno = (turno + 1) % lista.length;
        const anterior = activo;
        activo = reserva;
        reserva = anterior;
        activo.classList.remove('en-reserva');
        reserva.classList.add('en-reserva');
        activo.pause();
        if (activo.currentTime > 0) activo.currentTime = 0;
        reproducir();
        setTimeout(() => {
          reserva.removeAttribute('poster');
          reserva.src = lista[(turno + 1) % lista.length];
          reserva.load();
        }, 400);
      };
      videos.forEach((v) => v.addEventListener('ended', alTerminar));
    }
    videos.forEach((v) => v.addEventListener('playing', () => {
      necesitaToque = false;
      parado = false;
      pintarBoton();
      video.autoplay = false;
    }));
    if (boton) {
      boton.addEventListener('click', () => {
        parado = false;
        activo.play().catch(() => {});
      });
      pintarBoton();
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entrada]) => {
        aLaVista = entrada.isIntersecting;
        if (aLaVista) reproducir();
        else activo.pause();
      }, { threshold: 0.15 }).observe(video.parentElement);
    }
    if (!sinMovimiento) {
      const gestos = ['touchend', 'click', 'keydown'];
      const alPrimerGesto = () => reproducir();
      gestos.forEach((g) => document.addEventListener(g, alPrimerGesto, { passive: true }));
      video.addEventListener('playing', () => {
        gestos.forEach((g) => document.removeEventListener(g, alPrimerGesto));
      }, { once: true });
      reproducir();
    }
  }
  document.querySelectorAll('[data-filtros]').forEach((barra) => {
    const ambito = barra.closest('[data-carrusel]') || barra.parentElement;
    const lista = ambito.querySelector('[data-tira]');
    const botones = [...barra.querySelectorAll('[data-filtro]')];
    if (!lista || !botones.length) return;
    botones.forEach((boton) => {
      boton.addEventListener('click', () => {
        const filtro = boton.dataset.filtro;
        botones.forEach((otro) => otro.setAttribute('aria-pressed', String(otro === boton)));
        [...lista.children].forEach((pieza) => {
          pieza.hidden = filtro !== 'todo' && pieza.dataset.categoria !== filtro;
        });
        lista.scrollTo({ left: 0, behavior: 'auto' });
        lista.dispatchEvent(new Event('scroll'));   // pone al día las flechas
      });
    });
    barra.hidden = false;
  });
  const colocarPieza = (pieza) => {
    const tira = pieza.closest('[data-tira]');
    if (!tira || getComputedStyle(tira).overflowX === 'visible') return;
    const margen = parseFloat(getComputedStyle(tira).scrollPaddingLeft) || 0;
    const izquierda = tira.scrollLeft + pieza.getBoundingClientRect().left - tira.getBoundingClientRect().left - margen;
    tira.scrollTo({ left: Math.max(0, izquierda), behavior: 'auto' });
    tira.dispatchEvent(new Event('scroll'));   // pone al día las flechas
  };
  const irA = (destino, filtro, suave) => {
    const esPieza = destino.matches('[data-tira] > li');
    if (esPieza) colocarPieza(destino);
    if (filtro) destino.querySelector('[data-filtros] [data-filtro="' + filtro + '"]')?.click();
    const parada = esPieza ? (destino.closest('[data-carrusel]') || destino) : destino;
    parada.scrollIntoView({ behavior: suave && !sinMovimiento ? 'smooth' : 'auto', block: 'start' });
  };
  document.querySelectorAll('a[href^="#"]').forEach((enlace) => {
    const id = enlace.getAttribute('href').slice(1);
    const destino = id && document.getElementById(id);
    const filtro = enlace.dataset.filtroDestino;
    if (!destino || !(filtro || destino.matches('[data-tira] > li'))) return;   // el resto, como siempre
    enlace.addEventListener('click', (e) => {
      e.preventDefault();
      irA(destino, filtro, true);
      history.replaceState(null, '', '#' + id);
    });
  });
  const alAbrir = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (alAbrir && alAbrir.matches('[data-tira] > li')) irA(alAbrir, null, false);
})();

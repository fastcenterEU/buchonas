/* =====================================================================
   Citas · Buchona's Beauty Salon
   ---------------------------------------------------------------------
   Dos páginas usan este archivo:
   - cita.html (pública): cualquiera pide cita sin registrarse. Elige
     tratamiento, día y hora y deja sus datos de contacto.
   - reservas/ (privada): el salón entra con su contraseña para ver la
     agenda, confirmar, cancelar y añadir citas tomadas por teléfono.

   Correos: con EmailJS se envían de verdad. Sin configurar, funcionan en
   MODO DEMOSTRACIÓN y se muestran en la pestaña «Correos» del panel.

   IMPORTANTE: en esta versión los datos se guardan en el navegador
   (localStorage), así que cada dispositivo ve solo sus propias citas.
   Sirve para enseñar el sistema. Para usarlo con clientas reales hay
   que conectar el objeto `Store` a una base de datos (Firebase,
   Supabase…), que es además lo que hace segura la contraseña del salón.
   ===================================================================== */
(() => {
  'use strict';

  /* ---------------------------- CONFIGURACIÓN ---------------------------- */
  const CONFIG = {
    demo: true, // Crea citas de ejemplo y muestra el acceso de prueba al panel

    salon: {
      nombre: "Buchona's Beauty Salon",
      email: 'citas@buchonasbeautysalon.com', // CAMBIAR: aquí llegan los avisos de nuevas citas
      telefono: '943 90 69 15',
      direccion: 'Prudencia Arbide Kalea, 11, 20303 Irun, Gipuzkoa',
      clave: 'buchonas2026', // CAMBIAR: contraseña del panel del salón
    },

    // Horario por día (0 = domingo … 6 = sábado). null = cerrado
    horario: {
      0: null,
      1: ['09:30', '18:30'], 2: ['09:30', '18:30'], 3: ['09:30', '18:30'],
      4: ['09:30', '18:30'], 5: ['09:30', '18:30'],
      6: ['09:00', '13:00'],
    },
    festivos: [],             // Días cerrados, formato 'AAAA-MM-DD'
    intervalo: 30,            // minutos entre horas de inicio
    puestos: 2,               // citas que pueden coincidir a la vez
    antelacionHoras: 2,       // antelación mínima para pedir cita
    diasMaximos: 60,          // hasta cuántos días vista se puede reservar
    confirmacionAutomatica: false, // false = el salón confirma cada cita

    // Duraciones orientativas: ajustarlas con el salón
    servicios: [
      { id: 'facial', nombre: 'Facial', detalle: 'Limpieza, rituales Goddess Glow y Jade, Glass Skin', duracion: 60, precio: 'Desde 65 €' },
      { id: 'botox', nombre: 'Bótox capilar o alisado orgánico', detalle: 'Según el largo de la melena', duracion: 180, precio: 'Según largo' },
      { id: 'cabello', nombre: 'Tratamiento capilar', detalle: 'Repolarización Glow u oxigenación marina', duracion: 60, precio: 'Desde 35 €' },
      { id: 'labios', nombre: 'Hidratación de labios', detalle: 'Una sesión de las tres del tratamiento', duracion: 40, precio: '140 € (3 sesiones)' },
      { id: 'mirada', nombre: 'Cejas y pestañas', detalle: 'Diseño, tinte, laminado, lifting o extensiones', duracion: 60, precio: 'Desde 13 €' },
      { id: 'manos', nombre: 'Manos', detalle: 'Manicura rusa, semipermanente, refuerzo o gel', duracion: 60, precio: 'Desde 10 €' },
      { id: 'pies', nombre: 'Pies', detalle: 'Pedicura de limpieza, con OPI o spa', duracion: 60, precio: 'Desde 15 €' },
    ],

    // Envío real de correos con EmailJS (https://www.emailjs.com). La plantilla
    // usa {{to_email}}, {{to_name}}, {{subject}} y {{message}}. Vacío = demostración.
    emailjs: { publicKey: '', serviceId: '', templateId: '' },
  };

  /* ------------------------------ UTILIDADES ----------------------------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nuevoId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const dos = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const deMin = (m) => `${dos(Math.floor(m / 60))}:${dos(m % 60)}`;
  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const momento = (fecha, hora) => { const d = deIso(fecha); d.setMinutes(aMin(hora)); return d; };
  const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fechaLarga = (f) => mayus(deIso(f).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
  const fechaCorta = (f) => deIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const servicio = (sid) => CONFIG.servicios.find((s) => s.id === sid) || { id: sid, nombre: sid, duracion: 60, precio: '' };
  const fin = (c) => deMin(aMin(c.hora) + c.duracion);
  const duracionTexto = (m) => (m >= 60 ? `${String(m / 60).replace('.', ',')} h` : `${m} min`);
  const ESTADOS = { pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', completada: 'Completada' };

  /* ----------------------- ALMACENAMIENTO (Store) ------------------------
     Para producción, sustituir estas funciones por una base de datos.     */
  const Store = {
    leer(clave, defecto) { try { const v = localStorage.getItem('bbs_' + clave); return v ? JSON.parse(v) : defecto; } catch { return defecto; } },
    guardar(clave, valor) { try { localStorage.setItem('bbs_' + clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } },
    borrar(clave) { try { localStorage.removeItem('bbs_' + clave); } catch { /* nada */ } },
    citas() { return this.leer('citas', []); },
    guardarCitas(c) { this.guardar('citas', c); },
    correos() { return this.leer('correos', []); },
    guardarCorreos(c) { this.guardar('correos', c.slice(0, 100)); },
  };

  /* ----------------------------- DISPONIBILIDAD -------------------------- */
  function horarioDe(fecha) {
    if (CONFIG.festivos.includes(fecha)) return null;
    return CONFIG.horario[deIso(fecha).getDay()] || null;
  }
  function huecos(fecha, duracion) {
    const h = horarioDe(fecha);
    if (!h) return [];
    const apertura = aMin(h[0]), cierre = aMin(h[1]);
    const limite = Date.now() + CONFIG.antelacionHoras * 3600e3;
    const delDia = Store.citas().filter((c) => c.fecha === fecha && c.estado !== 'cancelada');
    const libres = [];
    for (let t = apertura; t + duracion <= cierre; t += CONFIG.intervalo) {
      if (momento(fecha, deMin(t)).getTime() < limite) continue;
      const ocupadas = delDia.filter((c) => aMin(c.hora) < t + duracion && aMin(c.hora) + c.duracion > t).length;
      if (ocupadas < CONFIG.puestos) libres.push(deMin(t));
    }
    return libres;
  }
  const dentroDePlazo = (d) => d >= hoy() && d <= sumarDias(hoy(), CONFIG.diasMaximos);

  /* -------------------------------- CORREOS ------------------------------ */
  const emailjsListo = () => CONFIG.emailjs.publicKey && CONFIG.emailjs.serviceId && CONFIG.emailjs.templateId;
  let promesaEmailjs = null;
  function cargarEmailjs() {
    if (!promesaEmailjs) {
      promesaEmailjs = new Promise((ok, mal) => {
        const s = document.createElement('script');
        s.src = 'https://cdn.jsdelivr.net/npm/@emailjs/browser@4.4.1/dist/email.min.js';
        s.onload = () => { window.emailjs.init({ publicKey: CONFIG.emailjs.publicKey }); ok(window.emailjs); };
        s.onerror = mal;
        document.head.append(s);
      });
    }
    return promesaEmailjs;
  }
  async function enviarCorreo(para, nombre, asunto, mensaje) {
    if (!para) return;
    const registro = { id: nuevoId(), para, asunto, mensaje, fecha: new Date().toISOString(), modo: 'demo' };
    if (emailjsListo()) {
      try {
        const ej = await cargarEmailjs();
        await ej.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, { to_email: para, to_name: nombre, subject: asunto, message: mensaje, reply_to: CONFIG.salon.email });
        registro.modo = 'enviado';
      } catch { registro.modo = 'error'; }
    }
    Store.guardarCorreos([registro, ...Store.correos()]);
  }
  const firma = () => `\n\n${CONFIG.salon.nombre}\n${CONFIG.salon.direccion}\nTel. ${CONFIG.salon.telefono}`;
  const detalle = (c) => `Tratamiento: ${servicio(c.servicio).nombre}\nDía: ${fechaLarga(c.fecha)}\nHora: ${c.hora} (hasta las ${fin(c)} aprox.)`;
  const Correos = {
    async nueva(c) {
      const ok = c.estado === 'confirmada';
      await enviarCorreo(c.email, c.nombre, ok ? 'Tu cita está confirmada' : 'Hemos recibido tu petición de cita',
        `Hola, ${c.nombre}:\n\n${ok ? 'Tu cita está confirmada. ¡Te esperamos!' : 'Hemos recibido tu petición de cita. Te escribiremos en cuanto la confirmemos.'}\n\n${detalle(c)}\n\nSi necesitas cambiarla o cancelarla, llámanos al ${CONFIG.salon.telefono}.${firma()}`);
      if (c.origen !== 'salon') {
        await enviarCorreo(CONFIG.salon.email, CONFIG.salon.nombre, `Nueva cita: ${c.nombre}, ${fechaCorta(c.fecha)} a las ${c.hora}`,
          `Nueva cita pedida desde la web${ok ? '' : ' (pendiente de confirmar)'}.\n\nClienta: ${c.nombre}\nTeléfono: ${c.telefono}\nEmail: ${c.email}\n${detalle(c)}${c.notas ? `\nNotas: ${c.notas}` : ''}`);
      }
    },
    confirmada: (c) => enviarCorreo(c.email, c.nombre, 'Tu cita está confirmada',
      `Hola, ${c.nombre}:\n\nTu cita está confirmada. ¡Te esperamos!\n\n${detalle(c)}\n\nSi necesitas cambiarla o cancelarla, llámanos al ${CONFIG.salon.telefono}.${firma()}`),
    cancelada: (c) => enviarCorreo(c.email, c.nombre, 'Tu cita se ha cancelado',
      `Hola, ${c.nombre}:\n\nTu cita se ha cancelado.\n\n${detalle(c)}\n\nPuedes pedir otra cuando quieras desde nuestra web o llamándonos al ${CONFIG.salon.telefono}.${firma()}`),
  };

  /* --------------------------- SESIÓN DEL SALÓN -------------------------- */
  const HORAS_SESION = 12;
  const sesionActiva = () => { const s = Store.leer('sesion', null); return !!(s && s.hasta > Date.now()); };
  const abrirSesion = () => Store.guardar('sesion', { hasta: Date.now() + HORAS_SESION * 3600e3 });
  const cerrarSesion = () => Store.borrar('sesion');

  /* -------------------------- DATOS DE EJEMPLO --------------------------- */
  function prepararDemo() {
    if (!CONFIG.demo || Store.leer('demo', false)) return;
    const citas = Store.citas();
    const ejemplos = [
      ['Laura Gómez', 'laura@ejemplo.com', '600 123 456', 'facial', '10:00', 'confirmada', ''],
      ['Marta Ruiz', 'marta@ejemplo.com', '611 222 333', 'botox', '09:30', 'pendiente', 'Pelo largo, primera vez'],
      ['Ane Etxeberria', 'ane@ejemplo.com', '622 444 555', 'manos', '16:00', 'confirmada', ''],
      ['Laura Gómez', 'laura@ejemplo.com', '600 123 456', 'labios', '12:00', 'pendiente', 'Segunda sesión'],
    ];
    let d = sumarDias(hoy(), 1), i = 0;
    while (i < ejemplos.length) {
      const f = iso(d), h = horarioDe(f);
      if (h) {
        const [nombre, email, telefono, sid, hora, estado, notas] = ejemplos[i];
        const s = servicio(sid);
        const valida = aMin(hora) >= aMin(h[0]) && aMin(hora) + s.duracion <= aMin(h[1]) ? hora : h[0];
        citas.push({ id: nuevoId(), nombre, email, telefono, servicio: sid, duracion: s.duracion, fecha: f, hora: valida, estado, notas, origen: 'web', creada: new Date().toISOString() });
        i++;
      }
      d = sumarDias(d, i % 2 ? 1 : 2);
    }
    Store.guardarCitas(citas);
    Store.guardar('demo', true);
  }

  /* -------------------------------- ESTADO ------------------------------- */
  const MODO = document.body.dataset.modo === 'salon' ? 'salon' : 'publico';
  const app = $('#app');
  let reserva = { servicio: null, fecha: null, hora: null, mes: null, datos: {} };
  let exito = null;
  let pestana = 'agenda';
  let agenda = { fecha: iso(hoy()), mes: null };

  function aviso(texto) {
    const el = $('[data-aviso]');
    el.textContent = texto; el.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.hidden = true; }, 5000);
  }
  const textoCorreo = (para) => (emailjsListo() ? `Correo enviado a ${para}.` : `Correo preparado para ${para} (modo demostración).`);

  /* ---------------------------- CALENDARIO ------------------------------- */
  function calendario({ mes, seleccion, habilitado, marca, prefijo, limitar }) {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const desfase = (primero.getDay() + 6) % 7;
    const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const nombreMes = mayus(primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }));
    const maxFecha = sumarDias(hoy(), CONFIG.diasMaximos);
    const antDesactivado = limitar && primero <= new Date(hoy().getFullYear(), hoy().getMonth(), 1);
    const sigDesactivado = limitar && primero >= new Date(maxFecha.getFullYear(), maxFecha.getMonth(), 1);
    let celdas = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="rv-cal__dia-semana" aria-hidden="true">${d}</div>`).join('');
    for (let i = 0; i < desfase; i++) celdas += '<div></div>';
    for (let n = 1; n <= diasMes; n++) {
      const d = new Date(mes.getFullYear(), mes.getMonth(), n), f = iso(d);
      const m = marca ? marca(f) : '';
      const clases = ['rv-cal__dia', f === iso(hoy()) && 'rv-cal__dia--hoy', !horarioDe(f) && 'rv-cal__dia--cerrado'].filter(Boolean).join(' ');
      celdas += `<button type="button" class="${clases}" data-accion="${prefijo}-dia" data-fecha="${f}" aria-pressed="${f === seleccion}" aria-label="${esc(fechaLarga(f))}${m ? `, ${m} citas` : ''}"${habilitado(f, d) ? '' : ' disabled'}>${n}${m ? `<span class="rv-cal__punto" aria-hidden="true">${m}</span>` : ''}</button>`;
    }
    return `
      <div class="rv-cal">
        <div class="rv-cal__cabeza">
          <p class="rv-cal__mes">${esc(nombreMes)}</p>
          <div class="rv-cal__nav">
            <button type="button" data-accion="${prefijo}-mes" data-delta="-1" aria-label="Mes anterior"${antDesactivado ? ' disabled' : ''}>‹</button>
            <button type="button" data-accion="${prefijo}-mes" data-delta="1" aria-label="Mes siguiente"${sigDesactivado ? ' disabled' : ''}>›</button>
          </div>
        </div>
        <div class="rv-cal__rejilla">${celdas}</div>
      </div>`;
  }

  /* --------------------------- PÁGINA PÚBLICA ---------------------------- */
  function vistaPublica() {
    if (exito) return vistaExito();
    const s = reserva.servicio ? servicio(reserva.servicio) : null;
    if (!reserva.mes) reserva.mes = new Date(hoy().getFullYear(), hoy().getMonth(), 1);
    const horas = s && reserva.fecha ? huecos(reserva.fecha, s.duracion) : [];
    if (reserva.hora && !horas.includes(reserva.hora)) reserva.hora = null;
    const d = reserva.datos;
    return `
      <h1 class="rv-titulo">Pide tu cita</h1>
      <p class="rv-entrada">Elige tratamiento, día y hora y déjanos tus datos. No hace falta registrarse: te mandamos la confirmación por correo.</p>
      <div class="rv-reserva" style="margin-top:32px">
        <div class="rv-tarjeta">
          <p class="rv-paso"><span>1</span> Tratamiento</p>
          <div class="rv-servicios" role="radiogroup" aria-label="Tratamiento">
            ${CONFIG.servicios.map((x) => `
              <label class="rv-servicio">
                <input type="radio" name="servicio" value="${x.id}" data-accion="servicio"${reserva.servicio === x.id ? ' checked' : ''}>
                <strong>${esc(x.nombre)}</strong>
                <span class="rv-precio">${esc(x.precio)}</span>
                <small>${esc(x.detalle)}. Unas ${duracionTexto(x.duracion)}.</small>
              </label>`).join('')}
          </div>
        </div>
        <div class="rv-tarjeta${s ? '' : ' rv-bloqueado'}">
          <p class="rv-paso"><span>2</span> Día</p>
          ${calendario({ mes: reserva.mes, seleccion: reserva.fecha, prefijo: 'res', limitar: true,
            habilitado: (f, dia) => !!s && dentroDePlazo(dia) && huecos(f, s.duracion).length > 0 })}
          <p class="rv-cal__leyenda">${s ? 'Solo se pueden elegir los días con horas libres.' : 'Elige primero un tratamiento.'} Los domingos está cerrado.</p>
        </div>
        <div class="rv-tarjeta${s && reserva.fecha ? '' : ' rv-bloqueado'}" data-paso-hora>
          <p class="rv-paso"><span>3</span> Hora</p>
          ${!reserva.fecha ? '<p class="rv-vacio">Elige un día en el calendario para ver las horas libres.</p>'
            : horas.length ? `<p class="rv-vacio" style="margin-bottom:12px">${esc(fechaLarga(reserva.fecha))}</p><div class="rv-horas">${horas.map((h) => `<button type="button" class="rv-hora" data-accion="hora" data-hora="${h}" aria-pressed="${reserva.hora === h}">${h}</button>`).join('')}</div>`
            : '<p class="rv-vacio">Ese día ya no quedan horas libres. Prueba con otro.</p>'}
        </div>
      </div>
      ${s && reserva.fecha && reserva.hora ? `
      <div class="rv-tarjeta rv-datos" data-paso-datos>
        <p class="rv-paso"><span>4</span> Tus datos</p>
        <div class="rv-datos__rejilla">
          <form class="rv-formulario" data-form="cita" novalidate>
            <div class="rv-campo"><label for="c-nombre">Nombre y apellidos</label><input id="c-nombre" name="nombre" autocomplete="name" value="${esc(d.nombre)}" data-campo required></div>
            <div class="rv-campo"><label for="c-tel">Teléfono</label><input id="c-tel" name="telefono" type="tel" autocomplete="tel" value="${esc(d.telefono)}" data-campo required></div>
            <div class="rv-campo"><label for="c-email">Email</label><input id="c-email" name="email" type="email" autocomplete="email" value="${esc(d.email)}" data-campo required></div>
            <div class="rv-campo"><label for="c-notas">Algo que debamos saber (opcional)</label><textarea id="c-notas" name="notas" data-campo placeholder="Largo del pelo, alergias, si es tu primera vez…">${esc(d.notas)}</textarea></div>
            <label class="rv-check"><input type="checkbox" name="privacidad" data-campo${d.privacidad ? ' checked' : ''}> <span>Acepto que el salón use estos datos para gestionar mi cita, según su <a href="legal.html">política de privacidad</a>.</span></label>
            <div class="rv-error" data-error hidden></div>
            <button class="btn btn--lg" type="submit">Pedir la cita</button>
          </form>
          <div class="rv-resumen">
            <dl>
              <dt>Tratamiento</dt><dd>${esc(s.nombre)}</dd>
              <dt>Día</dt><dd>${esc(fechaLarga(reserva.fecha))}</dd>
              <dt>Hora</dt><dd>${reserva.hora} a ${deMin(aMin(reserva.hora) + s.duracion)} aprox.</dd>
              <dt>Precio</dt><dd>${esc(s.precio)}</dd>
            </dl>
            <p class="rv-nota">${CONFIG.confirmacionAutomatica ? 'Recibirás la confirmación por correo al momento.' : 'El salón revisará tu petición y te confirmará la cita por correo.'} Para cambiarla o cancelarla, llama al <a href="tel:+34943906915">${CONFIG.salon.telefono}</a>.</p>
          </div>
        </div>
      </div>` : ''}`;
  }

  function vistaExito() {
    const c = exito;
    const ok = c.estado === 'confirmada';
    return `
      <div class="rv-tarjeta rv-exito">
        <div class="rv-exito__icono" aria-hidden="true">✓</div>
        <h1 class="rv-subtitulo">${ok ? 'Cita confirmada' : 'Petición enviada'}</h1>
        <p><strong>${esc(servicio(c.servicio).nombre)}</strong><br>${esc(fechaLarga(c.fecha))}, a las ${c.hora}</p>
        <p class="rv-nota">${ok ? `Te hemos enviado la confirmación a ${esc(c.email)}.` : `Te hemos enviado un correo a ${esc(c.email)}. Te escribiremos de nuevo cuando el salón confirme la cita.`}</p>
        <div class="rv-cita__acciones">
          <button class="btn" type="button" data-accion="ics">Añadir a mi calendario</button>
          <button class="btn btn--linea" type="button" data-accion="otra">Pedir otra cita</button>
        </div>
      </div>`;
  }

  /* ---------------------------- PANEL DEL SALÓN -------------------------- */
  function vistaLogin() {
    return `
      <div class="rv-acceso rv-acceso--salon">
        <div class="rv-tarjeta">
          <h1 class="rv-titulo">Acceso del salón</h1>
          <p class="rv-entrada">Entra para ver y gestionar las citas.</p>
          <form class="rv-formulario" data-form="login" novalidate style="margin-top:24px">
            <div class="rv-campo"><label for="l-clave">Contraseña</label><input id="l-clave" name="clave" type="password" autocomplete="current-password" required></div>
            <div class="rv-error" data-error hidden></div>
            <button class="btn btn--lg" type="submit">Entrar</button>
          </form>
        </div>
        ${CONFIG.demo ? `
        <aside class="rv-tarjeta rv-demo" aria-label="Demostración">
          <p class="rv-paso">Demostración</p>
          <p>Entra sin contraseña para ver el panel con citas de ejemplo. Este acceso desaparece al desactivar el modo demostración.</p>
          <button class="btn btn--claro" type="button" data-accion="demo-entrar">Ver el panel de ejemplo</button>
        </aside>` : ''}
      </div>`;
  }

  function tarjetaCita(c, conFecha) {
    const s = servicio(c.servicio);
    const futura = momento(c.fecha, c.hora) >= new Date();
    const activa = c.estado === 'pendiente' || c.estado === 'confirmada';
    let acciones = '';
    if (c.estado === 'pendiente') acciones += `<button class="btn rv-boton-peq" type="button" data-accion="confirmar" data-id="${c.id}">Confirmar</button>`;
    if (c.estado === 'confirmada' && !futura) acciones += `<button class="btn btn--linea rv-boton-peq" type="button" data-accion="completar" data-id="${c.id}">Marcar como hecha</button>`;
    if (activa && futura) acciones += `<button class="btn btn--peligro rv-boton-peq" type="button" data-accion="cancelar" data-id="${c.id}">Cancelar</button>`;
    return `
      <li class="rv-cita rv-cita--${c.estado}">
        <p class="rv-cita__hora">${c.hora}<small>${conFecha ? `${esc(fechaCorta(c.fecha))}<br>` : ''}hasta ${fin(c)}</small></p>
        <div>
          <p class="rv-cita__titulo">${esc(c.nombre)}<span class="rv-estado rv-estado--${c.estado}">${ESTADOS[c.estado]}</span></p>
          <p class="rv-cita__meta">${esc(s.nombre)}<br>
            ${c.telefono ? `<a href="tel:${esc(c.telefono.replace(/\s/g, ''))}">${esc(c.telefono)}</a>` : 'Sin teléfono'}${c.email ? `, <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.origen === 'salon' ? '<br>Añadida desde el panel' : ''}</p>
          ${c.notas ? `<p class="rv-cita__notas">${esc(c.notas)}</p>` : ''}
        </div>
        <div class="rv-cita__acciones">${acciones}</div>
      </li>`;
  }

  function vistaSalon() {
    const citas = Store.citas();
    const pendientes = citas.filter((c) => c.estado === 'pendiente' && momento(c.fecha, c.hora) >= new Date())
      .sort((a, b) => momento(a.fecha, a.hora) - momento(b.fecha, b.hora));
    const activas = (f) => citas.filter((c) => c.fecha === f && c.estado !== 'cancelada');
    const semana = citas.filter((c) => c.estado !== 'cancelada' && deIso(c.fecha) >= hoy() && deIso(c.fecha) < sumarDias(hoy(), 7)).length;
    let cuerpo = '';
    if (pestana === 'agenda') {
      if (!agenda.mes) agenda.mes = new Date(deIso(agenda.fecha).getFullYear(), deIso(agenda.fecha).getMonth(), 1);
      const delDia = citas.filter((c) => c.fecha === agenda.fecha).sort((a, b) => aMin(a.hora) - aMin(b.hora));
      const abierto = !!horarioDe(agenda.fecha);
      cuerpo = `
        <div class="rv-agenda">
          <div class="rv-tarjeta">
            ${calendario({ mes: agenda.mes, seleccion: agenda.fecha, prefijo: 'ag', habilitado: () => true, marca: (f) => activas(f).length || '' })}
            <p class="rv-cal__leyenda">El número de cada día son sus citas activas.</p>
          </div>
          <div>
            <div class="rv-agenda__cabeza">
              <h2>${esc(fechaLarga(agenda.fecha))}</h2>
              <button class="btn rv-boton-peq" type="button" data-accion="nueva-salon"${abierto && deIso(agenda.fecha) >= hoy() ? '' : ' disabled'}>Añadir cita</button>
            </div>
            ${!abierto ? '<div class="rv-banda">Este día el salón está cerrado.</div>' : ''}
            ${delDia.length ? `<ul class="rv-lista">${delDia.map((c) => tarjetaCita(c)).join('')}</ul>`
              : abierto ? '<div class="rv-tarjeta"><p class="rv-vacio">No hay citas este día.</p></div>' : ''}
          </div>
        </div>`;
    } else if (pestana === 'pendientes') {
      cuerpo = pendientes.length ? `<ul class="rv-lista">${pendientes.map((c) => tarjetaCita(c, true)).join('')}</ul>`
        : '<div class="rv-tarjeta"><p class="rv-vacio">No hay citas pendientes de confirmar.</p></div>';
    } else {
      const correos = Store.correos();
      cuerpo = `
        <div class="rv-banda">${emailjsListo()
          ? 'Registro de los últimos correos enviados.'
          : '<strong>Modo demostración:</strong> los correos aún no se envían. Aquí ves lo que recibiría cada persona. Para enviarlos de verdad, configura EmailJS en <code>citas.js</code>.'}</div>
        ${correos.length ? `<ul class="rv-lista">${correos.map((m) => `
          <li class="rv-correo">
            <div class="rv-correo__cabeza"><span>Para <strong>${esc(m.para)}</strong></span><span>${new Date(m.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}${m.modo === 'error' ? ', error al enviar' : ''}</span></div>
            <p class="rv-correo__asunto">${esc(m.asunto)}</p>
            <pre>${esc(m.mensaje)}</pre>
          </li>`).join('')}</ul>` : '<div class="rv-tarjeta"><p class="rv-vacio">Todavía no hay correos. Pide una cita desde la web pública para ver aquí los avisos.</p></div>'}
        ${CONFIG.demo ? '<button class="btn btn--peligro rv-boton-peq" type="button" data-accion="reiniciar" style="margin-top:20px">Borrar datos de demostración</button>' : ''}`;
    }
    const tab = (id, texto, n) => `<button type="button" role="tab" aria-selected="${pestana === id}" data-accion="pestana" data-pestana="${id}">${texto}${n ? `<span class="rv-contador">${n}</span>` : ''}</button>`;
    return `
      <h1 class="rv-titulo">Agenda del salón</h1>
      <div class="rv-cifras">
        <div class="rv-cifra"><strong>${activas(iso(hoy())).length}</strong><span>citas hoy</span></div>
        <div class="rv-cifra"><strong>${pendientes.length}</strong><span>por confirmar</span></div>
        <div class="rv-cifra"><strong>${semana}</strong><span>en los próximos 7 días</span></div>
      </div>
      <div class="rv-pestanas" role="tablist">${tab('agenda', 'Agenda')}${tab('pendientes', 'Por confirmar', pendientes.length)}${tab('correos', 'Correos')}</div>
      ${cuerpo}`;
  }

  /* ------------------------------- RENDER -------------------------------- */
  function render() {
    if (MODO === 'publico') { app.innerHTML = vistaPublica(); return; }
    const dentro = sesionActiva();
    const salir = $('[data-salir]');
    if (salir) salir.hidden = !dentro;
    app.innerHTML = dentro ? vistaSalon() : vistaLogin();
  }

  /* ---------------------------- DIÁLOGOS --------------------------------- */
  const dialogo = $('[data-dialogo]');
  function abrirDialogo(html) {
    $('[data-dialogo-cuerpo]').innerHTML = html;
    if (typeof dialogo.showModal === 'function') dialogo.showModal(); else dialogo.setAttribute('open', '');
  }
  const cerrarDialogo = () => (dialogo.close ? dialogo.close() : dialogo.removeAttribute('open'));

  function dialogoNuevaSalon() {
    const opciones = (sid) => huecos(agenda.fecha, servicio(sid).duracion).map((h) => `<option>${h}</option>`).join('') || '<option value="">Sin horas libres</option>';
    abrirDialogo(`
      <h2 id="dialogo-titulo">Nueva cita</h2>
      <p class="rv-nota" style="margin:-10px 0 16px">${esc(fechaLarga(agenda.fecha))}</p>
      <form class="rv-formulario" data-form="nueva-salon">
        <div class="rv-campo"><label for="s-nombre">Nombre de la clienta</label><input id="s-nombre" name="nombre" required></div>
        <div class="rv-campo"><label for="s-tel">Teléfono</label><input id="s-tel" name="telefono" type="tel"></div>
        <div class="rv-campo"><label for="s-email">Email, para mandarle la confirmación</label><input id="s-email" name="email" type="email"></div>
        <div class="rv-campo"><label for="s-serv">Tratamiento</label><select id="s-serv" name="servicio" data-cambia-servicio>${CONFIG.servicios.map((x) => `<option value="${x.id}">${esc(x.nombre)} (${duracionTexto(x.duracion)})</option>`).join('')}</select></div>
        <div class="rv-campo"><label for="s-hora">Hora</label><select id="s-hora" name="hora" required>${opciones(CONFIG.servicios[0].id)}</select></div>
        <div class="rv-campo"><label for="s-notas">Notas</label><textarea id="s-notas" name="notas"></textarea></div>
        <div class="rv-error" data-error hidden></div>
        <div class="rv-dialogo__acciones">
          <button class="btn btn--linea" type="button" data-accion="cerrar-dialogo">Volver</button>
          <button class="btn" type="submit">Guardar cita</button>
        </div>
      </form>`);
    $('[data-cambia-servicio]').addEventListener('change', (e) => { $('#s-hora').innerHTML = opciones(e.target.value); });
  }

  function confirmarAccion(titulo, texto, etiqueta, accion) {
    abrirDialogo(`
      <h2 id="dialogo-titulo">${esc(titulo)}</h2>
      <p>${texto}</p>
      <div class="rv-dialogo__acciones" style="margin-top:22px">
        <button class="btn btn--linea" type="button" data-accion="cerrar-dialogo">Volver</button>
        <button class="btn btn--peligro" type="button" data-confirmar>${esc(etiqueta)}</button>
      </div>`);
    $('[data-confirmar]').addEventListener('click', async () => { cerrarDialogo(); await accion(); }, { once: true });
  }

  /* ----------------------------- ACCIONES -------------------------------- */
  function actualizarCita(cid, cambios) {
    const citas = Store.citas();
    const c = citas.find((x) => x.id === cid);
    if (!c) return null;
    Object.assign(c, cambios);
    Store.guardarCitas(citas);
    return c;
  }

  function descargarIcs(c) {
    const s = servicio(c.servicio);
    const f = (fecha, hora) => fecha.replace(/-/g, '') + 'T' + hora.replace(':', '') + '00';
    const texto = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Buchonas Beauty Salon//Citas//ES', 'BEGIN:VEVENT',
      `UID:${c.id}@buchonasbeautysalon`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${f(c.fecha, c.hora)}`, `DTEND:${f(c.fecha, fin(c))}`,
      `SUMMARY:${s.nombre} en Buchona's Beauty Salon`, `LOCATION:${CONFIG.salon.direccion.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Para cambiar o cancelar la cita llama al ${CONFIG.salon.telefono}`,
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'text/calendar' }));
    a.download = `cita-buchonas-${c.fecha}.ics`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const mostrarError = (form, texto) => { const e = $('[data-error]', form); e.textContent = texto; e.hidden = false; e.scrollIntoView({ block: 'nearest' }); };
  const emailValido = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  // Guardar lo que la clienta va escribiendo, por si cambia de hora o de día
  app.addEventListener('input', (e) => {
    const campo = e.target.closest('[data-campo]');
    if (campo) reserva.datos[campo.name] = campo.type === 'checkbox' ? campo.checked : campo.value;
  });

  app.addEventListener('submit', async (ev) => {
    const form = ev.target;
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(form));

    if (form.dataset.form === 'login') {
      if ((datos.clave || '') !== CONFIG.salon.clave) return mostrarError(form, 'La contraseña no es correcta.');
      abrirSesion(); pestana = 'agenda'; render(); app.focus();
    }

    if (form.dataset.form === 'cita') {
      const nombre = (datos.nombre || '').trim(), telefono = (datos.telefono || '').trim(), email = (datos.email || '').trim().toLowerCase();
      if (!nombre) return mostrarError(form, 'Escribe tu nombre.');
      if (telefono.replace(/\D/g, '').length < 9) return mostrarError(form, 'Escribe un teléfono de al menos 9 cifras.');
      if (!emailValido(email)) return mostrarError(form, 'Escribe un email válido para recibir la confirmación.');
      if (!datos.privacidad) return mostrarError(form, 'Marca la casilla de privacidad para poder pedir la cita.');
      const s = servicio(reserva.servicio);
      if (!huecos(reserva.fecha, s.duracion).includes(reserva.hora)) {
        reserva.hora = null; render(); aviso('Esa hora se acaba de ocupar. Elige otra, por favor.'); return;
      }
      const c = { id: nuevoId(), nombre, telefono, email, servicio: s.id, duracion: s.duracion, fecha: reserva.fecha, hora: reserva.hora,
        estado: CONFIG.confirmacionAutomatica ? 'confirmada' : 'pendiente', notas: (datos.notas || '').trim(), origen: 'web', creada: new Date().toISOString() };
      Store.guardarCitas([...Store.citas(), c]);
      exito = c;
      reserva = { servicio: null, fecha: null, hora: null, mes: null, datos: { nombre, telefono, email } };
      render(); window.scrollTo({ top: 0, behavior: 'smooth' });
      await Correos.nueva(c);
      aviso(textoCorreo(c.email));
    }
  });

  dialogo.addEventListener('submit', async (ev) => {
    const form = ev.target;
    if (form.dataset.form !== 'nueva-salon') return;
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.nombre.trim()) return mostrarError(form, 'Escribe el nombre de la clienta.');
    if (!d.hora) return mostrarError(form, 'Ese tratamiento no cabe en ninguna hora libre de este día.');
    if (d.email.trim() && !emailValido(d.email.trim())) return mostrarError(form, 'El email no es válido. Corrígelo o déjalo vacío.');
    const s = servicio(d.servicio);
    const c = { id: nuevoId(), nombre: d.nombre.trim(), email: d.email.trim().toLowerCase(), telefono: d.telefono.trim(), servicio: s.id, duracion: s.duracion,
      fecha: agenda.fecha, hora: d.hora, estado: 'confirmada', notas: d.notas.trim(), origen: 'salon', creada: new Date().toISOString() };
    Store.guardarCitas([...Store.citas(), c]);
    cerrarDialogo(); render();
    if (c.email) { await Correos.nueva(c); aviso('Cita guardada. ' + textoCorreo(c.email)); } else aviso('Cita guardada.');
  });

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-accion]');
    if (!el) return;
    switch (el.dataset.accion) {
      // Página pública
      case 'servicio':
        reserva.servicio = el.value; reserva.hora = null;
        if (reserva.fecha && !huecos(reserva.fecha, servicio(el.value).duracion).length) reserva.fecha = null;
        render(); break;
      case 'res-mes':
        reserva.mes = new Date(reserva.mes.getFullYear(), reserva.mes.getMonth() + Number(el.dataset.delta), 1); render(); break;
      case 'res-dia':
        reserva.fecha = el.dataset.fecha; reserva.hora = null; render();
        if (innerWidth < 1000) $('[data-paso-hora]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'hora':
        reserva.hora = el.dataset.hora; render();
        $('[data-paso-datos]')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      case 'ics':
        if (exito) descargarIcs(exito); break;
      case 'otra':
        exito = null; render(); break;

      // Panel del salón
      case 'demo-entrar':
        if (CONFIG.demo) { abrirSesion(); pestana = 'agenda'; render(); app.focus(); }
        break;
      case 'salir':
        cerrarSesion(); render(); aviso('Has salido del panel.'); break;
      case 'pestana':
        pestana = el.dataset.pestana; render(); break;
      case 'confirmar': {
        const c = actualizarCita(el.dataset.id, { estado: 'confirmada' }); render();
        if (c?.email) { await Correos.confirmada(c); aviso('Cita confirmada. ' + textoCorreo(c.email)); } else aviso('Cita confirmada.');
        break;
      }
      case 'completar':
        actualizarCita(el.dataset.id, { estado: 'completada' }); render(); aviso('Cita marcada como hecha.'); break;
      case 'cancelar': {
        const c = Store.citas().find((x) => x.id === el.dataset.id); if (!c) return;
        confirmarAccion('¿Cancelar esta cita?', `${esc(c.nombre)}: ${esc(servicio(c.servicio).nombre)}, ${esc(fechaLarga(c.fecha))} a las ${c.hora}.${c.email ? ' Le llegará un aviso por correo.' : ''}`, 'Cancelar cita', async () => {
          const act = actualizarCita(c.id, { estado: 'cancelada' }); render();
          if (act.email) { await Correos.cancelada(act); aviso('Cita cancelada. ' + textoCorreo(act.email)); } else aviso('Cita cancelada.');
        });
        break;
      }
      case 'ag-mes':
        agenda.mes = new Date(agenda.mes.getFullYear(), agenda.mes.getMonth() + Number(el.dataset.delta), 1); render(); break;
      case 'ag-dia':
        agenda.fecha = el.dataset.fecha; render(); break;
      case 'nueva-salon':
        dialogoNuevaSalon(); break;
      case 'cerrar-dialogo':
        cerrarDialogo(); break;
      case 'reiniciar':
        confirmarAccion('¿Borrar los datos de demostración?', 'Se borrarán las citas y los correos guardados en este navegador y se crearán de nuevo las citas de ejemplo.', 'Borrar datos', async () => {
          ['citas', 'correos', 'demo'].forEach((k) => Store.borrar(k));
          prepararDemo(); render(); aviso('Datos de demostración restablecidos.');
        });
        break;
      default:
    }
  });

  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) cerrarDialogo(); });

  prepararDemo();
  render();
})();

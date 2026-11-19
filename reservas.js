/* =====================================================================
   Sistema de citas · Buchona's Beauty Salon
   ---------------------------------------------------------------------
   - Clientas: crean su cuenta, reservan en el calendario, consultan y
     cancelan sus citas.
   - Salón: agenda con todas las citas, confirma, cancela, marca como
     completadas y añade citas tomadas por teléfono.
   - Correos: confirmaciones y avisos con EmailJS. Mientras no se
     configure, funciona en MODO DEMOSTRACIÓN y los correos se guardan
     en la pestaña «Correos» del panel del salón.

   IMPORTANTE: en esta versión los datos se guardan en el navegador
   (localStorage). Es perfecta para enseñar y probar el sistema, pero
   para usarla con clientas reales hay que conectar el objeto `Store`
   a un servidor o base de datos (por ejemplo Firebase o Supabase),
   para que las citas se compartan entre dispositivos y las cuentas
   sean seguras.
   ===================================================================== */
(() => {
  'use strict';

  /* ---------------------------- CONFIGURACIÓN ---------------------------- */
  const CONFIG = {
    demo: true, // Muestra los accesos de prueba y crea datos de ejemplo

    salon: {
      nombre: "Buchona's Beauty Salon",
      email: 'citas@buchonasbeautysalon.com', // CAMBIAR: aquí llegan los avisos de nuevas citas
      telefono: '943 90 69 15',
      direccion: 'Prudencia Arbide Kalea, 11, 20303 Irun, Gipuzkoa',
      claveInicial: 'buchonas2026', // CAMBIAR antes de publicar
    },

    // Horario por día de la semana (0 = domingo ... 6 = sábado). null = cerrado
    horario: {
      0: null,
      1: ['09:30', '18:30'], 2: ['09:30', '18:30'], 3: ['09:30', '18:30'],
      4: ['09:30', '18:30'], 5: ['09:30', '18:30'],
      6: ['09:00', '13:00'],
    },
    festivos: [], // Días cerrados, formato 'AAAA-MM-DD'
    intervalo: 30,            // minutos entre horas de inicio
    puestos: 2,               // citas que pueden coincidir a la vez (Arelis y Dennise)
    antelacionHoras: 2,       // antelación mínima para reservar
    diasMaximos: 60,          // hasta cuántos días vista se puede reservar
    cancelarHastaHoras: 24,   // la clienta puede cancelar hasta X horas antes
    confirmacionAutomatica: false, // false = el salón confirma cada cita

    // Duraciones orientativas: ajustarlas con el salón
    servicios: [
      { id: 'facial', nombre: 'Facial', detalle: 'Higiene facial, rituales Goddess Glow y Jade, Glass Skin', duracion: 60, precio: 'Desde 65 €' },
      { id: 'botox', nombre: 'Bótox capilar o alisado orgánico', detalle: 'Según el largo de la melena, de corta a XL', duracion: 180, precio: 'Según largo' },
      { id: 'cabello', nombre: 'Tratamiento capilar', detalle: 'Repolarización Glow u oxigenación marina', duracion: 60, precio: 'Desde 35 €' },
      { id: 'labios', nombre: 'Hidratación de labios', detalle: 'Sesión de 40 minutos (tratamiento de 3 sesiones)', duracion: 40, precio: '140 € / 3 sesiones' },
      { id: 'unas', nombre: 'Uñas', detalle: 'Manicura rusa, semipermanente, refuerzo o gel', duracion: 60, precio: 'Desde 10 €' },
      { id: 'pedicura', nombre: 'Pedicura', detalle: 'De limpieza, con esmalte OPI o semipermanente spa', duracion: 60, precio: 'Desde 15 €' },
      { id: 'mirada', nombre: 'Cejas y pestañas', detalle: 'Diseño, tinte y laminado de cejas; lifting y extensiones', duracion: 60, precio: 'Desde 13 €' },
    ],

    // Envío real de correos con EmailJS (https://www.emailjs.com).
    // Crea una plantilla con las variables {{to_email}}, {{to_name}}, {{subject}} y {{message}}
    // y rellena estos tres datos. Si se dejan vacíos, se usa el modo demostración.
    emailjs: { publicKey: '', serviceId: '', templateId: '' },
  };

  /* ------------------------------ UTILIDADES ----------------------------- */
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const dos = (n) => String(n).padStart(2, '0');
  const iso = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
  const deIso = (s) => { const [a, m, d] = s.split('-').map(Number); return new Date(a, m - 1, d); };
  const aMin = (h) => { const [a, b] = h.split(':').map(Number); return a * 60 + b; };
  const deMin = (m) => `${dos(Math.floor(m / 60))}:${dos(m % 60)}`;
  const hoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const momento = (fecha, hora) => { const d = deIso(fecha); d.setMinutes(aMin(hora)); return d; };
  const fechaLarga = (f) => deIso(f).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const fechaCorta = (f) => deIso(f).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
  const mayus = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const servicio = (sid) => CONFIG.servicios.find((s) => s.id === sid) || { nombre: sid, duracion: 60, precio: '' };
  const fin = (c) => deMin(aMin(c.hora) + c.duracion);
  const ESTADOS = { pendiente: 'Pendiente', confirmada: 'Confirmada', cancelada: 'Cancelada', completada: 'Completada' };

  async function cifrar(texto) {
    const datos = new TextEncoder().encode('bbs:' + texto);
    if (window.crypto && crypto.subtle) {
      const h = await crypto.subtle.digest('SHA-256', datos);
      return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0; for (const b of datos) h = (h * 31 + b) | 0; return 'x' + h; // reserva si no hay SubtleCrypto
  }

  /* ----------------------- ALMACENAMIENTO (Store) ------------------------
     Sustituir estas funciones por llamadas a una base de datos para
     usar el sistema en producción.                                       */
  const Store = {
    leer(clave, defecto) { try { const v = localStorage.getItem('bbs_' + clave); return v ? JSON.parse(v) : defecto; } catch { return defecto; } },
    guardar(clave, valor) { try { localStorage.setItem('bbs_' + clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ } },
    borrar(clave) { try { localStorage.removeItem('bbs_' + clave); } catch { /* nada */ } },
    usuarios() { return this.leer('usuarios', []); },
    guardarUsuarios(u) { this.guardar('usuarios', u); },
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
  function huecos(fecha, duracion, ignorarId) {
    const h = horarioDe(fecha);
    if (!h) return [];
    const apertura = aMin(h[0]), cierre = aMin(h[1]);
    const limite = Date.now() + CONFIG.antelacionHoras * 3600e3;
    const delDia = Store.citas().filter((c) => c.fecha === fecha && c.estado !== 'cancelada' && c.id !== ignorarId);
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
    if (!para) return null;
    const registro = { id: id(), para, asunto, mensaje, fecha: new Date().toISOString(), modo: 'demo' };
    if (emailjsListo()) {
      try {
        const ej = await cargarEmailjs();
        await ej.send(CONFIG.emailjs.serviceId, CONFIG.emailjs.templateId, { to_email: para, to_name: nombre, subject: asunto, message: mensaje, reply_to: CONFIG.salon.email });
        registro.modo = 'enviado';
      } catch { registro.modo = 'error'; }
    }
    Store.guardarCorreos([registro, ...Store.correos()]);
    return registro;
  }
  const firma = () => `\n\n${CONFIG.salon.nombre}\n${CONFIG.salon.direccion}\nTel. ${CONFIG.salon.telefono}`;
  const detalle = (c) => `Servicio: ${servicio(c.servicio).nombre}\nDía: ${mayus(fechaLarga(c.fecha))}\nHora: ${c.hora} (hasta las ${fin(c)} aprox.)`;
  const Correos = {
    async nueva(c) {
      const confirmada = c.estado === 'confirmada';
      await enviarCorreo(c.email, c.nombre,
        confirmada ? 'Tu cita está confirmada' : 'Hemos recibido tu solicitud de cita',
        `Hola, ${c.nombre}:\n\n${confirmada ? 'Tu cita está confirmada.' : 'Hemos recibido tu solicitud de cita. Te escribiremos en cuanto la confirmemos.'}\n\n${detalle(c)}\n\nPuedes consultar o cancelar tu cita desde tu cuenta en la web.${firma()}`);
      if (c.origen !== 'salon') {
        await enviarCorreo(CONFIG.salon.email, CONFIG.salon.nombre, `Nueva cita: ${c.nombre} · ${fechaCorta(c.fecha)} ${c.hora}`,
          `Nueva cita reservada en la web${confirmada ? '' : ' (pendiente de confirmar)'}.\n\nClienta: ${c.nombre}\nTeléfono: ${c.telefono || '—'}\nEmail: ${c.email}\n${detalle(c)}${c.notas ? `\nNotas: ${c.notas}` : ''}`);
      }
    },
    async confirmada(c) {
      await enviarCorreo(c.email, c.nombre, 'Tu cita está confirmada',
        `Hola, ${c.nombre}:\n\n¡Tu cita está confirmada! Te esperamos.\n\n${detalle(c)}${firma()}`);
    },
    async cancelada(c, porSalon) {
      await enviarCorreo(c.email, c.nombre, 'Tu cita ha sido cancelada',
        `Hola, ${c.nombre}:\n\n${porSalon ? 'Lamentamos comunicarte que hemos tenido que cancelar tu cita.' : 'Hemos cancelado tu cita, tal y como nos pediste.'}\n\n${detalle(c)}\n\nPuedes reservar una nueva cita cuando quieras desde la web.${firma()}`);
      if (!porSalon) {
        await enviarCorreo(CONFIG.salon.email, CONFIG.salon.nombre, `Cita cancelada: ${c.nombre} · ${fechaCorta(c.fecha)} ${c.hora}`,
          `La clienta ha cancelado su cita.\n\nClienta: ${c.nombre}\nTeléfono: ${c.telefono || '—'}\n${detalle(c)}`);
      }
    },
  };

  /* ------------------------------ SESIÓN --------------------------------- */
  const sesion = () => {
    const email = Store.leer('sesion', null);
    return email ? Store.usuarios().find((u) => u.email === email) || null : null;
  };
  const iniciarSesion = (u) => { Store.guardar('sesion', u.email); vista = { pestana: u.rol === 'salon' ? 'agenda' : 'nueva' }; };
  const cerrarSesion = () => { Store.borrar('sesion'); vista = { pestana: 'entrar' }; };

  /* -------------------------- DATOS DE PRUEBA ---------------------------- */
  async function prepararDatos() {
    const usuarios = Store.usuarios();
    if (!usuarios.some((u) => u.rol === 'salon')) {
      usuarios.push({ id: id(), rol: 'salon', nombre: 'Arelis y Dennise', email: CONFIG.salon.email, telefono: CONFIG.salon.telefono, clave: await cifrar(CONFIG.salon.claveInicial) });
    }
    if (CONFIG.demo && !Store.leer('demo', false)) {
      const demo = { id: id(), rol: 'clienta', nombre: 'Laura Gómez', email: 'laura@ejemplo.com', telefono: '600 123 456', clave: await cifrar(id()) };
      usuarios.push(demo);
      const citas = Store.citas();
      const ejemplos = [
        ['Laura Gómez', 'laura@ejemplo.com', '600 123 456', 'facial', '10:00', 'confirmada', ''],
        ['Marta Ruiz', 'marta@ejemplo.com', '611 222 333', 'botox', '09:30', 'pendiente', 'Pelo largo, primera vez'],
        ['Ane Etxeberria', 'ane@ejemplo.com', '622 444 555', 'unas', '16:00', 'confirmada', ''],
        ['Laura Gómez', 'laura@ejemplo.com', '600 123 456', 'labios', '12:00', 'pendiente', 'Segunda sesión'],
      ];
      let d = sumarDias(hoy(), 1), i = 0;
      while (i < ejemplos.length) {
        const f = iso(d), h = horarioDe(f);
        if (h) {
          const [nombre, email, telefono, sid, hora, estado, notas] = ejemplos[i];
          const horaValida = aMin(hora) + servicio(sid).duracion <= aMin(h[1]) && aMin(hora) >= aMin(h[0]) ? hora : h[0];
          citas.push({ id: id(), nombre, email, telefono, servicio: sid, duracion: servicio(sid).duracion, fecha: f, hora: horaValida, estado, notas, origen: 'web', creada: new Date().toISOString() });
          i++;
        }
        d = sumarDias(d, i % 2 ? 1 : 2);
      }
      Store.guardarCitas(citas);
      Store.guardar('demo', true);
    }
    Store.guardarUsuarios(usuarios);
  }

  /* -------------------------------- ESTADO ------------------------------- */
  let vista = { pestana: 'entrar' };
  let reserva = { servicio: null, fecha: null, hora: null, mes: null };
  let agenda = { fecha: iso(hoy()), mes: null };
  const app = $('#app');

  function aviso(texto) {
    const el = $('[data-aviso]');
    el.textContent = texto; el.hidden = false;
    clearTimeout(aviso.t); aviso.t = setTimeout(() => { el.hidden = true; }, 5000);
  }
  const textoCorreo = (para) => emailjsListo()
    ? `Te hemos enviado un correo a ${para}.`
    : `Correo de aviso preparado para ${para} (modo demostración).`;

  /* ---------------------------- CALENDARIO ------------------------------- */
  function calendario({ mes, seleccion, habilitado, marca, prefijo }) {
    const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
    const desfase = (primero.getDay() + 6) % 7; // semana empieza en lunes
    const diasMes = new Date(mes.getFullYear(), mes.getMonth() + 1, 0).getDate();
    const nombreMes = primero.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const minMes = prefijo === 'res' ? new Date(hoy().getFullYear(), hoy().getMonth(), 1) : null;
    const maxFecha = sumarDias(hoy(), CONFIG.diasMaximos);
    const maxMes = prefijo === 'res' ? new Date(maxFecha.getFullYear(), maxFecha.getMonth(), 1) : null;
    let celdas = ['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => `<div class="rv-cal__dia-semana" aria-hidden="true">${d}</div>`).join('');
    for (let i = 0; i < desfase; i++) celdas += '<div></div>';
    for (let n = 1; n <= diasMes; n++) {
      const d = new Date(mes.getFullYear(), mes.getMonth(), n), f = iso(d);
      const ok = habilitado(f, d);
      const m = marca ? marca(f) : '';
      celdas += `<button type="button" class="rv-cal__dia${f === iso(hoy()) ? ' rv-cal__dia--hoy' : ''}${horarioDe(f) ? '' : ' rv-cal__dia--cerrado'}" data-accion="${prefijo}-dia" data-fecha="${f}" aria-pressed="${f === seleccion}" aria-label="${esc(mayus(fechaLarga(f)))}${m ? `, ${m} citas` : ''}"${ok ? '' : ' disabled'}>${n}${m ? `<span class="rv-cal__punto" aria-hidden="true">${m}</span>` : ''}</button>`;
    }
    return `
      <div class="rv-cal">
        <div class="rv-cal__cabeza">
          <p class="rv-cal__mes">${esc(mayus(nombreMes))}</p>
          <div class="rv-cal__nav">
            <button type="button" data-accion="${prefijo}-mes" data-delta="-1" aria-label="Mes anterior"${minMes && primero <= minMes ? ' disabled' : ''}>‹</button>
            <button type="button" data-accion="${prefijo}-mes" data-delta="1" aria-label="Mes siguiente"${maxMes && primero >= maxMes ? ' disabled' : ''}>›</button>
          </div>
        </div>
        <div class="rv-cal__rejilla">${celdas}</div>
      </div>`;
  }

  /* ------------------------------- VISTAS -------------------------------- */
  function render() {
    const u = sesion();
    const cuenta = $('[data-cuenta]');
    cuenta.hidden = !u;
    $('.barra__dentro').classList.toggle('rv-con-sesion', !!u);
    if (u) $('[data-cuenta-nombre]').textContent = u.rol === 'salon' ? 'Panel del salón' : u.nombre;
    if (!u) app.innerHTML = vistaAcceso();
    else if (u.rol === 'salon') app.innerHTML = vistaSalon();
    else app.innerHTML = vistaClienta(u);
  }

  function vistaAcceso() {
    const registro = vista.pestana === 'registro';
    return `
      <h1 class="rv-titulo">Tu cita en Buchona's</h1>
      <p class="rv-entrada">Entra en tu cuenta para elegir servicio, día y hora, y consultar o cancelar tus citas. Recibirás la confirmación por correo electrónico.</p>
      <div class="rv-acceso">
        <div class="rv-tarjeta">
          <div class="rv-pestanas" role="tablist" style="margin-top:0">
            <button type="button" role="tab" aria-selected="${!registro}" data-accion="pestana" data-pestana="entrar">Iniciar sesión</button>
            <button type="button" role="tab" aria-selected="${registro}" data-accion="pestana" data-pestana="registro">Crear cuenta</button>
          </div>
          ${registro ? `
          <form class="rv-formulario" data-form="registro" novalidate>
            <div class="rv-campo"><label for="r-nombre">Nombre y apellidos</label><input id="r-nombre" name="nombre" autocomplete="name" required></div>
            <div class="rv-campo"><label for="r-email">Email</label><input id="r-email" name="email" type="email" autocomplete="email" required></div>
            <div class="rv-campo"><label for="r-tel">Teléfono</label><input id="r-tel" name="telefono" type="tel" autocomplete="tel" required></div>
            <div class="rv-campo"><label for="r-clave">Contraseña (mínimo 6 caracteres)</label><input id="r-clave" name="clave" type="password" autocomplete="new-password" minlength="6" required></div>
            <label class="rv-check"><input type="checkbox" name="privacidad" required> <span>He leído y acepto la <a href="legal.html">política de privacidad</a>.</span></label>
            <div class="rv-error" data-error hidden></div>
            <button class="btn btn--lg" type="submit">Crear cuenta</button>
          </form>` : `
          <form class="rv-formulario" data-form="entrar" novalidate>
            <div class="rv-campo"><label for="e-email">Email</label><input id="e-email" name="email" type="email" autocomplete="email" required></div>
            <div class="rv-campo"><label for="e-clave">Contraseña</label><input id="e-clave" name="clave" type="password" autocomplete="current-password" required></div>
            <div class="rv-error" data-error hidden></div>
            <button class="btn btn--lg" type="submit">Entrar</button>
            <p class="rv-nota">¿No tienes cuenta? <a href="#" data-accion="pestana" data-pestana="registro">Créala en un minuto</a>. ¿Has olvidado la contraseña? Llámanos al <a href="tel:+34943906915">${CONFIG.salon.telefono}</a>.</p>
          </form>`}
        </div>
        ${CONFIG.demo ? `
        <aside class="rv-tarjeta rv-demo" aria-label="Acceso de demostración">
          <p class="rv-paso">Modo demostración</p>
          <p>Prueba el sistema sin crear una cuenta. Los datos son de ejemplo y se guardan solo en este navegador.</p>
          <button class="btn" type="button" data-accion="demo" data-rol="clienta">Entrar como clienta</button>
          <button class="btn btn--claro" type="button" data-accion="demo" data-rol="salon">Entrar como salón</button>
        </aside>` : ''}
      </div>`;
  }

  function vistaClienta(u) {
    const mias = Store.citas().filter((c) => c.email === u.email);
    const proximas = mias.filter((c) => c.estado !== 'cancelada' && c.estado !== 'completada' && momento(c.fecha, c.hora) >= new Date())
      .sort((a, b) => momento(a.fecha, a.hora) - momento(b.fecha, b.hora));
    const pestana = vista.pestana === 'mis' ? 'mis' : vista.pestana === 'exito' ? 'exito' : 'nueva';
    return `
      <h1 class="rv-titulo">Hola, ${esc(u.nombre.split(' ')[0])}</h1>
      <div class="rv-pestanas" role="tablist">
        <button type="button" role="tab" aria-selected="${pestana !== 'mis'}" data-accion="pestana" data-pestana="nueva">Nueva cita</button>
        <button type="button" role="tab" aria-selected="${pestana === 'mis'}" data-accion="pestana" data-pestana="mis">Mis citas${proximas.length ? `<span class="rv-contador">${proximas.length}</span>` : ''}</button>
      </div>
      ${pestana === 'mis' ? vistaMisCitas(mias, proximas) : pestana === 'exito' ? vistaExito() : vistaNuevaCita()}`;
  }

  function vistaNuevaCita() {
    const s = reserva.servicio ? servicio(reserva.servicio) : null;
    if (!reserva.mes) reserva.mes = new Date(hoy().getFullYear(), hoy().getMonth(), 1);
    const horas = s && reserva.fecha ? huecos(reserva.fecha, s.duracion) : [];
    if (reserva.hora && !horas.includes(reserva.hora)) reserva.hora = null;
    return `
      <div class="rv-reserva">
        <div class="rv-tarjeta">
          <p class="rv-paso"><span>1</span> Elige el servicio</p>
          <div class="rv-servicios" role="radiogroup" aria-label="Servicio">
            ${CONFIG.servicios.map((x) => `
              <label class="rv-servicio">
                <input type="radio" name="servicio" value="${x.id}" data-accion="servicio"${reserva.servicio === x.id ? ' checked' : ''}>
                <strong>${esc(x.nombre)}</strong>
                <span class="rv-precio">${esc(x.precio)}</span>
                <small>${esc(x.detalle)} · ${x.duracion >= 60 ? `${x.duracion / 60} h`.replace('.5', ',5') : `${x.duracion} min`} aprox.</small>
              </label>`).join('')}
          </div>
        </div>
        <div class="rv-tarjeta${s ? '' : ' rv-bloqueado'}">
          <p class="rv-paso"><span>2</span> Elige el día</p>
          ${calendario({
            mes: reserva.mes, seleccion: reserva.fecha, prefijo: 'res',
            habilitado: (f, d) => !!s && dentroDePlazo(d) && huecos(f, s.duracion).length > 0,
          })}
          <p class="rv-cal__leyenda">Domingos cerrado. Puedes reservar con hasta ${CONFIG.diasMaximos} días de antelación.</p>
        </div>
        <div class="rv-tarjeta${s && reserva.fecha ? '' : ' rv-bloqueado'}" data-paso-hora>
          <p class="rv-paso"><span>3</span> Elige la hora</p>
          ${!reserva.fecha ? '<p class="rv-vacio">Primero elige un día en el calendario.</p>'
            : horas.length ? `<p class="rv-vacio" style="margin-bottom:12px">${esc(mayus(fechaLarga(reserva.fecha)))}</p><div class="rv-horas">${horas.map((h) => `<button type="button" class="rv-hora" data-accion="hora" data-hora="${h}" aria-pressed="${reserva.hora === h}">${h}</button>`).join('')}</div>`
            : '<p class="rv-vacio">No quedan horas libres ese día. Prueba con otro.</p>'}
          ${s && reserva.fecha && reserva.hora ? `
          <div class="rv-resumen" style="margin-top:24px;padding-top:20px;border-top:1px solid var(--linea)">
            <p class="rv-paso"><span>4</span> Confirma tu cita</p>
            <dl>
              <dt>Servicio</dt><dd>${esc(s.nombre)}</dd>
              <dt>Día</dt><dd>${esc(mayus(fechaLarga(reserva.fecha)))}</dd>
              <dt>Hora</dt><dd>${reserva.hora} – ${deMin(aMin(reserva.hora) + s.duracion)} aprox.</dd>
              <dt>Precio</dt><dd>${esc(s.precio)}</dd>
            </dl>
            <div class="rv-campo"><label for="notas">Notas para el salón (opcional)</label><textarea id="notas" data-notas placeholder="Por ejemplo: largo del pelo, alergias, si es tu primera vez…"></textarea></div>
            <button class="btn btn--lg" type="button" data-accion="reservar">Reservar cita</button>
            <p class="rv-nota">${CONFIG.confirmacionAutomatica ? 'Recibirás la confirmación por correo.' : 'El salón confirmará tu cita y te avisará por correo.'} Puedes cancelarla hasta ${CONFIG.cancelarHastaHoras} h antes.</p>
          </div>` : ''}
        </div>
      </div>`;
  }

  function vistaExito() {
    const c = Store.citas().find((x) => x.id === vista.ultima);
    if (!c) return vistaNuevaCita();
    return `
      <div class="rv-tarjeta rv-exito">
        <div class="rv-exito__icono" aria-hidden="true">✓</div>
        <h2 class="rv-subtitulo">${c.estado === 'confirmada' ? '¡Cita confirmada!' : '¡Solicitud enviada!'}</h2>
        <p>${esc(servicio(c.servicio).nombre)} · ${esc(mayus(fechaLarga(c.fecha)))} a las ${c.hora}</p>
        <p class="rv-nota">${c.estado === 'confirmada' ? 'Te hemos enviado la confirmación por correo.' : 'Te hemos enviado un correo con los datos. Te avisaremos en cuanto el salón la confirme.'}</p>
        <div class="rv-cita__acciones">
          <button class="btn" type="button" data-accion="ics" data-id="${c.id}">Añadir a mi calendario</button>
          <button class="btn btn--linea" type="button" data-accion="pestana" data-pestana="mis">Ver mis citas</button>
        </div>
      </div>`;
  }

  function tarjetaCita(c, { salon = false } = {}) {
    const s = servicio(c.servicio);
    const futura = momento(c.fecha, c.hora) >= new Date();
    const activa = c.estado === 'pendiente' || c.estado === 'confirmada';
    const puedeCancelar = activa && (salon ? futura : momento(c.fecha, c.hora) - Date.now() > CONFIG.cancelarHastaHoras * 3600e3);
    let acciones = '';
    if (salon) {
      if (c.estado === 'pendiente') acciones += `<button class="btn rv-boton-peq" type="button" data-accion="confirmar" data-id="${c.id}">Confirmar</button>`;
      if (c.estado === 'confirmada' && !futura) acciones += `<button class="btn btn--linea rv-boton-peq" type="button" data-accion="completar" data-id="${c.id}">Completada</button>`;
      if (puedeCancelar) acciones += `<button class="btn btn--peligro rv-boton-peq" type="button" data-accion="cancelar" data-id="${c.id}">Cancelar</button>`;
    } else {
      if (activa && futura) acciones += `<button class="btn btn--linea rv-boton-peq" type="button" data-accion="ics" data-id="${c.id}">Añadir al calendario</button>`;
      if (puedeCancelar) acciones += `<button class="btn btn--peligro rv-boton-peq" type="button" data-accion="cancelar" data-id="${c.id}">Cancelar</button>`;
      else if (activa && futura) acciones += `<p class="rv-nota" style="margin:0">Para cancelarla, llama al <a href="tel:+34943906915">${CONFIG.salon.telefono}</a>.</p>`;
    }
    return `
      <li class="rv-cita rv-cita--${c.estado}">
        <p class="rv-cita__hora">${c.hora}<small>${salon ? `hasta ${fin(c)}` : esc(fechaCorta(c.fecha))}</small></p>
        <div>
          <p class="rv-cita__titulo">${esc(salon ? c.nombre : s.nombre)}<span class="rv-estado rv-estado--${c.estado}">${ESTADOS[c.estado]}</span></p>
          <p class="rv-cita__meta">${salon
            ? `${esc(s.nombre)} · ${c.telefono ? `<a href="tel:${esc(c.telefono.replace(/\s/g, ''))}">${esc(c.telefono)}</a>` : 'sin teléfono'}${c.email ? ` · <a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : ''}${c.origen === 'salon' ? ' · añadida por el salón' : ''}`
            : `${esc(mayus(fechaLarga(c.fecha)))} · ${c.hora}–${fin(c)}`}</p>
          ${c.notas ? `<p class="rv-cita__notas">${esc(c.notas)}</p>` : ''}
        </div>
        <div class="rv-cita__acciones">${acciones}</div>
      </li>`;
  }

  function vistaMisCitas(mias, proximas) {
    const pasadas = mias.filter((c) => !proximas.includes(c)).sort((a, b) => momento(b.fecha, b.hora) - momento(a.fecha, a.hora));
    return `
      <h2 class="rv-subtitulo">Próximas citas</h2>
      ${proximas.length ? `<ul class="rv-lista">${proximas.map((c) => tarjetaCita(c)).join('')}</ul>`
        : '<div class="rv-tarjeta"><p class="rv-vacio">No tienes citas próximas.</p><button class="btn" type="button" data-accion="pestana" data-pestana="nueva" style="margin-top:14px">Reservar cita</button></div>'}
      ${pasadas.length ? `<h2 class="rv-subtitulo">Historial</h2><ul class="rv-lista">${pasadas.map((c) => tarjetaCita(c)).join('')}</ul>` : ''}`;
  }

  function vistaSalon() {
    const citas = Store.citas();
    const pendientes = citas.filter((c) => c.estado === 'pendiente' && momento(c.fecha, c.hora) >= new Date())
      .sort((a, b) => momento(a.fecha, a.hora) - momento(b.fecha, b.hora));
    const activas = (f) => citas.filter((c) => c.fecha === f && c.estado !== 'cancelada');
    const semana = citas.filter((c) => c.estado !== 'cancelada' && deIso(c.fecha) >= hoy() && deIso(c.fecha) < sumarDias(hoy(), 7)).length;
    const pestana = ['pendientes', 'correos'].includes(vista.pestana) ? vista.pestana : 'agenda';
    const correos = Store.correos();
    let cuerpo = '';
    if (pestana === 'agenda') {
      if (!agenda.mes) agenda.mes = new Date(deIso(agenda.fecha).getFullYear(), deIso(agenda.fecha).getMonth(), 1);
      const delDia = citas.filter((c) => c.fecha === agenda.fecha).sort((a, b) => aMin(a.hora) - aMin(b.hora));
      const abierto = !!horarioDe(agenda.fecha);
      cuerpo = `
        <div class="rv-agenda">
          <div class="rv-tarjeta">
            ${calendario({ mes: agenda.mes, seleccion: agenda.fecha, prefijo: 'ag', habilitado: () => true, marca: (f) => activas(f).length || '' })}
            <p class="rv-cal__leyenda">El número indica las citas activas de cada día.</p>
          </div>
          <div>
            <div class="rv-agenda__cabeza">
              <h2>${esc(mayus(fechaLarga(agenda.fecha)))}</h2>
              <button class="btn rv-boton-peq" type="button" data-accion="nueva-salon"${abierto && deIso(agenda.fecha) >= hoy() ? '' : ' disabled'}>+ Añadir cita</button>
            </div>
            ${!abierto ? '<div class="rv-banda">El salón está cerrado este día.</div>' : ''}
            ${delDia.length ? `<ul class="rv-lista">${delDia.map((c) => tarjetaCita(c, { salon: true })).join('')}</ul>`
              : abierto ? '<div class="rv-tarjeta"><p class="rv-vacio">No hay citas este día.</p></div>' : ''}
          </div>
        </div>`;
    } else if (pestana === 'pendientes') {
      cuerpo = pendientes.length
        ? `<ul class="rv-lista">${pendientes.map((c) => tarjetaCita(c, { salon: true }).replace('<small>hasta', `<small>${esc(fechaCorta(c.fecha))}<br>hasta`)).join('')}</ul>`
        : '<div class="rv-tarjeta"><p class="rv-vacio">No hay citas pendientes de confirmar.</p></div>';
    } else {
      cuerpo = `
        <div class="rv-banda">${emailjsListo()
          ? 'Los correos se envían con EmailJS. Aquí tienes el registro de los últimos envíos.'
          : '<strong>Modo demostración:</strong> los correos no se envían todavía; aquí ves exactamente lo que recibiría cada persona. Para enviarlos de verdad, configura EmailJS en <code>reservas.js</code>.'}</div>
        ${correos.length ? `<ul class="rv-lista">${correos.map((m) => `
          <li class="rv-correo">
            <div class="rv-correo__cabeza"><span>Para: <strong>${esc(m.para)}</strong></span><span>${new Date(m.fecha).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}${m.modo === 'error' ? ' · error al enviar' : m.modo === 'enviado' ? ' · enviado' : ''}</span></div>
            <p class="rv-correo__asunto">${esc(m.asunto)}</p>
            <pre>${esc(m.mensaje)}</pre>
          </li>`).join('')}</ul>` : '<div class="rv-tarjeta"><p class="rv-vacio">Todavía no se ha generado ningún correo. Reserva una cita como clienta para verlo aquí.</p></div>'}
        ${CONFIG.demo ? '<button class="btn btn--peligro rv-boton-peq" type="button" data-accion="reiniciar" style="margin-top:20px">Restablecer datos de demostración</button>' : ''}`;
    }
    return `
      <h1 class="rv-titulo">Agenda del salón</h1>
      <div class="rv-cifras">
        <div class="rv-cifra"><strong>${activas(iso(hoy())).length}</strong><span>citas hoy</span></div>
        <div class="rv-cifra"><strong>${pendientes.length}</strong><span>por confirmar</span></div>
        <div class="rv-cifra"><strong>${semana}</strong><span>próximos 7 días</span></div>
      </div>
      <div class="rv-pestanas" role="tablist">
        <button type="button" role="tab" aria-selected="${pestana === 'agenda'}" data-accion="pestana" data-pestana="agenda">Agenda</button>
        <button type="button" role="tab" aria-selected="${pestana === 'pendientes'}" data-accion="pestana" data-pestana="pendientes">Por confirmar${pendientes.length ? `<span class="rv-contador">${pendientes.length}</span>` : ''}</button>
        <button type="button" role="tab" aria-selected="${pestana === 'correos'}" data-accion="pestana" data-pestana="correos">Correos</button>
      </div>
      ${cuerpo}`;
  }

  /* ---------------------------- DIÁLOGOS --------------------------------- */
  const dialogo = $('[data-dialogo]');
  function abrirDialogo(html) {
    $('[data-dialogo-cuerpo]').innerHTML = html;
    if (typeof dialogo.showModal === 'function') dialogo.showModal(); else dialogo.setAttribute('open', '');
  }
  const cerrarDialogo = () => (dialogo.close ? dialogo.close() : dialogo.removeAttribute('open'));

  function dialogoNuevaSalon() {
    const opcionesHora = (sid) => huecos(agenda.fecha, servicio(sid).duracion).map((h) => `<option>${h}</option>`).join('');
    const primero = CONFIG.servicios[0].id;
    abrirDialogo(`
      <h2 id="dialogo-titulo">Nueva cita</h2>
      <p class="rv-nota" style="margin:-10px 0 16px">${esc(mayus(fechaLarga(agenda.fecha)))}</p>
      <form class="rv-formulario" data-form="nueva-salon">
        <div class="rv-campo"><label for="s-nombre">Nombre de la clienta</label><input id="s-nombre" name="nombre" required></div>
        <div class="rv-campo"><label for="s-tel">Teléfono</label><input id="s-tel" name="telefono" type="tel"></div>
        <div class="rv-campo"><label for="s-email">Email (para enviarle la confirmación)</label><input id="s-email" name="email" type="email"></div>
        <div class="rv-campo"><label for="s-serv">Servicio</label><select id="s-serv" name="servicio" data-cambia-servicio>${CONFIG.servicios.map((x) => `<option value="${x.id}">${esc(x.nombre)} (${x.duracion} min)</option>`).join('')}</select></div>
        <div class="rv-campo"><label for="s-hora">Hora</label><select id="s-hora" name="hora" required>${opcionesHora(primero) || '<option value="">Sin horas libres</option>'}</select></div>
        <div class="rv-campo"><label for="s-notas">Notas</label><textarea id="s-notas" name="notas"></textarea></div>
        <div class="rv-error" data-error hidden></div>
        <div class="rv-dialogo__acciones">
          <button class="btn btn--linea" type="button" data-accion="cerrar-dialogo">Cancelar</button>
          <button class="btn" type="submit">Guardar cita</button>
        </div>
      </form>`);
    $('[data-cambia-servicio]').addEventListener('change', (e) => {
      $('#s-hora').innerHTML = opcionesHora(e.target.value) || '<option value="">Sin horas libres</option>';
    });
  }

  function confirmarAccion(titulo, texto, boton, accion) {
    abrirDialogo(`
      <h2 id="dialogo-titulo">${esc(titulo)}</h2>
      <p>${texto}</p>
      <div class="rv-dialogo__acciones" style="margin-top:22px">
        <button class="btn btn--linea" type="button" data-accion="cerrar-dialogo">Volver</button>
        <button class="btn btn--peligro" type="button" data-confirmar>${esc(boton)}</button>
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
    const texto = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Buchonas Beauty Salon//Citas//ES', 'BEGIN:VEVENT',
      `UID:${c.id}@buchonasbeautysalon`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`,
      `DTSTART:${f(c.fecha, c.hora)}`, `DTEND:${f(c.fecha, fin(c))}`,
      `SUMMARY:${s.nombre} · Buchona's Beauty Salon`,
      `LOCATION:${CONFIG.salon.direccion.replace(/,/g, '\\,')}`,
      `DESCRIPTION:Cita en Buchona's Beauty Salon. Tel. ${CONFIG.salon.telefono}`,
      'END:VEVENT', 'END:VCALENDAR',
    ].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([texto], { type: 'text/calendar' }));
    a.download = `cita-buchonas-${c.fecha}.ics`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  const mostrarError = (form, texto) => { const e = $('[data-error]', form); e.textContent = texto; e.hidden = false; };

  app.addEventListener('submit', async (ev) => {
    const form = ev.target;
    ev.preventDefault();
    const datos = Object.fromEntries(new FormData(form));
    if (form.dataset.form === 'entrar') {
      const email = (datos.email || '').trim().toLowerCase();
      const u = Store.usuarios().find((x) => x.email.toLowerCase() === email);
      if (!u || u.clave !== await cifrar(datos.clave || '')) return mostrarError(form, 'El email o la contraseña no son correctos.');
      iniciarSesion(u); render(); app.focus();
    }
    if (form.dataset.form === 'registro') {
      const email = (datos.email || '').trim().toLowerCase();
      if (!datos.nombre?.trim() || !datos.telefono?.trim()) return mostrarError(form, 'Completa tu nombre y tu teléfono.');
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return mostrarError(form, 'Escribe un email válido.');
      if ((datos.clave || '').length < 6) return mostrarError(form, 'La contraseña debe tener al menos 6 caracteres.');
      if (!datos.privacidad) return mostrarError(form, 'Para crear la cuenta tienes que aceptar la política de privacidad.');
      const usuarios = Store.usuarios();
      if (usuarios.some((x) => x.email.toLowerCase() === email)) return mostrarError(form, 'Ya existe una cuenta con ese email. Inicia sesión.');
      const u = { id: id(), rol: 'clienta', nombre: datos.nombre.trim(), email, telefono: datos.telefono.trim(), clave: await cifrar(datos.clave), creada: new Date().toISOString() };
      usuarios.push(u); Store.guardarUsuarios(usuarios);
      iniciarSesion(u); render(); app.focus();
      aviso('Cuenta creada. Ya puedes reservar tu cita.');
    }
  });

  dialogo.addEventListener('submit', async (ev) => {
    const form = ev.target;
    if (form.dataset.form !== 'nueva-salon') return;
    ev.preventDefault();
    const d = Object.fromEntries(new FormData(form));
    if (!d.nombre.trim()) return mostrarError(form, 'Escribe el nombre de la clienta.');
    if (!d.hora) return mostrarError(form, 'No hay horas libres para ese servicio este día.');
    const s = servicio(d.servicio);
    const c = { id: id(), nombre: d.nombre.trim(), email: d.email.trim().toLowerCase(), telefono: d.telefono.trim(), servicio: s.id, duracion: s.duracion, fecha: agenda.fecha, hora: d.hora, estado: 'confirmada', notas: d.notas.trim(), origen: 'salon', creada: new Date().toISOString() };
    Store.guardarCitas([...Store.citas(), c]);
    cerrarDialogo(); render();
    if (c.email) { await Correos.nueva(c); aviso('Cita guardada. ' + textoCorreo(c.email)); } else aviso('Cita guardada.');
  });

  document.addEventListener('click', async (ev) => {
    const el = ev.target.closest('[data-accion]');
    if (!el) return;
    const accion = el.dataset.accion;
    const u = sesion();
    switch (accion) {
      case 'pestana':
        ev.preventDefault();
        vista = { pestana: el.dataset.pestana }; render(); break;
      case 'salir':
        cerrarSesion(); reserva = { servicio: null, fecha: null, hora: null, mes: null }; render(); aviso('Has cerrado sesión.'); break;
      case 'demo': {
        const lista = Store.usuarios();
        const elegido = el.dataset.rol === 'salon' ? lista.find((x) => x.rol === 'salon') : lista.find((x) => x.email === 'laura@ejemplo.com');
        if (elegido) { iniciarSesion(elegido); render(); app.focus(); }
        break;
      }
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
        reserva.hora = el.dataset.hora; render(); $('[data-notas]')?.focus({ preventScroll: true }); $('.rv-resumen')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); break;
      case 'reservar': {
        if (!u) return;
        const s = servicio(reserva.servicio);
        if (!huecos(reserva.fecha, s.duracion).includes(reserva.hora)) { aviso('Esa hora acaba de ocuparse. Elige otra, por favor.'); reserva.hora = null; render(); return; }
        const c = { id: id(), nombre: u.nombre, email: u.email, telefono: u.telefono, servicio: s.id, duracion: s.duracion, fecha: reserva.fecha, hora: reserva.hora, estado: CONFIG.confirmacionAutomatica ? 'confirmada' : 'pendiente', notas: ($('[data-notas]')?.value || '').trim(), origen: 'web', creada: new Date().toISOString() };
        Store.guardarCitas([...Store.citas(), c]);
        reserva = { servicio: null, fecha: null, hora: null, mes: null };
        vista = { pestana: 'exito', ultima: c.id }; render(); window.scrollTo({ top: 0, behavior: 'smooth' });
        await Correos.nueva(c);
        aviso(textoCorreo(c.email));
        break;
      }
      case 'ics': {
        const c = Store.citas().find((x) => x.id === el.dataset.id); if (c) descargarIcs(c); break;
      }
      case 'cancelar': {
        const c = Store.citas().find((x) => x.id === el.dataset.id); if (!c) return;
        const porSalon = u?.rol === 'salon';
        confirmarAccion('¿Cancelar la cita?', `${esc(servicio(c.servicio).nombre)}${porSalon ? ` de ${esc(c.nombre)}` : ''}, ${esc(fechaLarga(c.fecha))} a las ${c.hora}.${c.email ? ' Se enviará un aviso por correo.' : ''}`, 'Sí, cancelar', async () => {
          const act = actualizarCita(c.id, { estado: 'cancelada' }); render();
          if (act.email) { await Correos.cancelada(act, porSalon); aviso('Cita cancelada. ' + textoCorreo(act.email)); } else aviso('Cita cancelada.');
        });
        break;
      }
      case 'confirmar': {
        const c = actualizarCita(el.dataset.id, { estado: 'confirmada' }); render();
        if (c?.email) { await Correos.confirmada(c); aviso('Cita confirmada. ' + textoCorreo(c.email)); } else aviso('Cita confirmada.');
        break;
      }
      case 'completar':
        actualizarCita(el.dataset.id, { estado: 'completada' }); render(); aviso('Cita marcada como completada.'); break;
      case 'ag-mes':
        agenda.mes = new Date(agenda.mes.getFullYear(), agenda.mes.getMonth() + Number(el.dataset.delta), 1); render(); break;
      case 'ag-dia':
        agenda.fecha = el.dataset.fecha; render(); break;
      case 'nueva-salon':
        dialogoNuevaSalon(); break;
      case 'cerrar-dialogo':
        cerrarDialogo(); break;
      case 'reiniciar':
        confirmarAccion('¿Restablecer la demostración?', 'Se borrarán las citas, cuentas y correos guardados en este navegador y se crearán de nuevo los datos de ejemplo.', 'Restablecer', async () => {
          ['usuarios', 'citas', 'correos', 'sesion', 'demo'].forEach((k) => Store.borrar(k));
          await prepararDatos(); vista = { pestana: 'entrar' }; render(); aviso('Demostración restablecida.');
        });
        break;
      default:
    }
  });

  // Menú del resto de la web (no hay en esta página, pero mantenemos Escape para el diálogo)
  dialogo.addEventListener('click', (e) => { if (e.target === dialogo) cerrarDialogo(); });

  prepararDatos().then(() => {
    const u = sesion();
    if (u) vista = { pestana: u.rol === 'salon' ? 'agenda' : 'nueva' };
    render();
  });
})();

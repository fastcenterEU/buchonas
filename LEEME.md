# Buchona's Beauty Salon · Web con sistema de citas propio

Copia de la web con reservas online propias en lugar de AgendaPro.

## Archivos nuevos o modificados
- `index.html`: los botones «Reservar cita» llevan a `reservas.html`. Hay un enlace nuevo, «Mi cuenta», en el menú.
- `reservas.html`, `reservas.css` y `reservas.js`: el sistema de citas.

El resto (`styles.css`, `main.js`, `legal.html`, `imagenes/`, `videos/`) es igual que el original.

## Qué hace
- **Clientas:** crean su cuenta o inician sesión. Eligen servicio, día en el calendario y hora libre. También pueden consultar o cancelar sus citas y añadirlas a su calendario (.ics).
- **Salón:** agenda mensual con las citas de cada día. Desde ahí confirma, cancela o marca citas como completadas, y añade las que llegan por teléfono.
- **Correos:** se envían al reservar, confirmar o cancelar, a la clienta y al salón.

## Configuración (al principio de `reservas.js`)
- **Datos del salón:** horario, festivos, servicios y duraciones, y citas simultáneas (`puestos`).
- **Cuenta del salón:** `salon.email` y `salon.claveInicial`. Cambia la clave antes de publicar.
- **Correo real:** crea una cuenta en EmailJS y rellena `emailjs.publicKey`, `serviceId` y `templateId`. La plantilla debe usar las variables `{{to_email}}`, `{{to_name}}`, `{{subject}}` y `{{message}}`. Sin estos datos, la web funciona en **modo demostración** y los correos se muestran en la pestaña «Correos» del panel.
- **Modo demostración:** con `demo: true` aparecen los botones de prueba y se crean citas de ejemplo. Ponlo en `false` para producción.

## Antes de usarlo con clientas reales
Esta versión guarda los datos en el navegador (localStorage). Sirve para enseñar y probar el sistema, pero tiene dos límites: las citas no se comparten entre dispositivos y las cuentas no son seguras.

Para producción hay que conectar el objeto `Store` de `reservas.js` a una base de datos con autenticación, por ejemplo Firebase o Supabase. También hay que actualizar la política de privacidad, porque el sistema guarda nombre, email y teléfono.

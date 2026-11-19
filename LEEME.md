# Buchona's Beauty Salon · Web nueva con reservas

Diseño, código y textos originales de FastCenter.

## Archivos
- `index.html`, `estilo.css` y `web.js`: la web.
- `cita.html`: página pública para pedir cita. No hace falta registrarse.
- `reservas/`: panel privado del salón, protegido con contraseña. Su dirección es `tudominio/reservas/`.
- `citas.js` y `citas.css`: el sistema de citas que usan las dos páginas.
- `legal.html`: página legal, pendiente de los datos del salón.
- `fotos/`: imágenes provisionales.

## Fotos
Las imágenes de `fotos/` son provisionales. Pide las fotos al salón y sustitúyelas por las suyas manteniendo los mismos nombres:

| Archivo | Foto |
|---|---|
| `salon.webp` | Interior del salón (portada) |
| `hermanas.webp` | Arelis y Dennise |
| `alisado-antes.webp` y `alisado-despues.webp` | Comparador del bótox capilar |
| `labios-antes.webp` y `labios-despues.webp` | Comparador de labios |
| `trabajo-1.webp` a `trabajo-6.webp` | Galería: uñas, cabello, pestañas, labios, pedicura y facial |

Usa formato vertical 4:5 (por ejemplo 720 × 900 px) y WebP o JPG. Si cambias la extensión, cambia también el nombre en `index.html`.

## Opiniones
Las cuatro opiniones son de clientas reales y están citadas tal cual. Comprueba que coinciden con las reseñas del perfil de Google del salón.

## Sistema de citas
Al pedir cita, la clienta elige tratamiento, día y hora libre, y deja su nombre, teléfono y email. Recibe un correo de que la petición ha llegado y otro cuando el salón la confirma. El salón recibe un aviso de cada cita nueva.

Desde `/reservas/`, el salón entra con su contraseña. Allí ve la agenda, confirma y cancela citas (la clienta recibe un correo en ambos casos) y añade las citas que llegan por teléfono.

La configuración está al principio de `citas.js`: contraseña del salón, email de avisos, horario, festivos, tratamientos y duraciones, EmailJS y modo demostración. Con `demo: true` se crean citas de ejemplo y el panel muestra un acceso sin contraseña. Ponlo en `false` antes de usarlo de verdad.

**Limitación importante:** esta versión guarda las citas en el navegador. Una cita pedida desde el móvil de una clienta no aparece en el panel del salón. Además, la contraseña se puede leer en el código de la página. Para usarlo con clientas reales hay que conectar el objeto `Store` de `citas.js` a una base de datos con login seguro, como Firebase o Supabase.

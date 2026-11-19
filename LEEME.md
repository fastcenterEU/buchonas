# Buchona's Beauty Salon · Web nueva con reservas

Diseño, código y textos originales de FastCenter.

## Archivos
- `index.html`, `estilo.css` y `web.js`: la web.
- `reservas.html`, `reservas.css` y `reservas.js`: el sistema de citas, con login, vista de clienta y panel del salón.
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
La configuración (horario, servicios, email, EmailJS y modo demostración) está al principio de `reservas.js`.

Esta versión guarda los datos en el navegador: sirve para enseñarla y probarla. Para usarla con clientas reales hay que conectar el objeto `Store` a una base de datos con login seguro, como Firebase o Supabase.

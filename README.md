# 🐱 Gatonplayseries Scraper Bot

## 🤖 ¿Qué hace este script?
Este bot de Python es un extractor masivo (Custom Scraper) construido a la medida para respaldar el catálogo completo de `gatonplayseries.com`. Su misión es analizar años y páginas de forma automatizada, descargar portadas, extraer las contraseñas/pesos y empujar toda la información directamente a tu base de datos de producción (Supabase) alojada en Hetzner.

---

## ⚙️ ¿Cómo funciona (El Flujo)?
1. **Paginación Inteligente:** Tú le das un rango de años (Ej. `1965` a `2026`). El bot recorre automáticamente la paginación (`/page/1/`, `/page/2/`...) hasta que detecta que el año no tiene más registros.
2. **Cruce de Datos (Deep Scraping):**
   - Entra a la página del catálogo para capturar Título, Año, Tipo (Pelicula/Serie) y Calificación.
   - Entra a la **página interna** de cada película para robar la sinopsis completa, las resoluciones, los pesos, los idiomas y la **contraseña del archivo rar**.
   - Escanea los botones para capturar la URL final de **Enlaces Públicos** (el Paste).
3. **Descarga de Portadas:** Evita hotlinking descargando la imagen en alta calidad (desde TMDB) a una carpeta local llamada `/portadas/`.
4. **Inyección por Túnel SSH:** Construye un script de PostgreSQL dinámico y lo dispara directamente dentro del contenedor `jadenn-db` de tu servidor en Alemania (Hetzner) sin necesidad de abrir puertos públicos.

---

## 📊 ¿Qué datos guarda en Supabase?
Todo se inserta en el esquema `gatonplayseries` (tablas `movies` y `series`), guardando:

* `title`: El nombre limpio del contenido.
* `type`: Categorización automática (pelicula o serie).
* `cover_image_url`: La URL original de la portada.
* `rating`: La calificación en puntos.
* `release_date`: El año o fecha de salida.
* `pgratis_url`: El enlace crudo al paste para que luego tu sistema *WPSafeLink Bypasser* haga el trabajo.
* **`raw_metadata` (LA MINA DE ORO):** Aquí se guarda el bloque de texto crudo extraído de la página interna. Incluye datos vitales como: *Peso en GB, Resolución (1080p, 4K), Idiomas, Duración y Contraseñas de los archivos RAR.*

---

## 📝 Sistema de Logs Seguros
Para evitar que tengas que adivinar qué ha procesado el bot, generará y actualizará automáticamente un archivo llamado `log_anos.json`.
Ahí podrás ver año por año cuántas películas se encontraron y a qué hora terminó el escaneo.

---

## 🚀 ¿Cómo ejecutarlo?
1. Abre tu terminal.
2. Navega al directorio del proyecto: `cd c:\server\Gatonplayseries`
3. Edita la última línea del archivo `scraper.py` si quieres cambiar el año de inicio. Por defecto está `iniciar_escaneo_completo(1965, 2026)`.
4. Corre el script: `python scraper.py`

> **Nota de Seguridad Anti-Ban:** El script cuenta con pausas automáticas de 0.5s y 1.0s. No las elimines, ya que previenen que el Firewall de Cloudflare o Hetzner bloquee tu IP por ataques de denegación de servicio (DDoS).

# Compilar STL

Compilar STL es un prototipo de laminador 3D que funciona en el navegador y se puede instalar como aplicación web progresiva (PWA) en Android. El modelo se procesa localmente; no se carga a un servidor.

La identidad visual usa el logo CSTL en la cabecera y como icono de la aplicación instalada, con acentos en cian y azul eléctrico.

La interfaz se adapta a pantallas táctiles pequeñas: presenta primero la carga y vista del modelo, apila las secciones, amplía los controles y respeta las áreas seguras del dispositivo. Los archivos de este proyecto son una aplicación web/PWA, no un proyecto Android Studio nativo; para empaquetarla como APK se necesita envolver la web (por ejemplo, con Capacitor o un WebView) y probar especialmente permisos de archivos, red local y contenido mixto HTTPS/HTTP.

## Probar en un ordenador

Desde esta carpeta, inicia un servidor web local:

```powershell
python -m http.server 8000
```

Abre `http://localhost:8000` en Chrome o Edge. La importación STL y el laminado también se pueden probar abriendo `index.html` directamente, pero el modo sin conexión de la PWA requiere un servidor web.

## Instalar en Android

Publica estos archivos en un sitio con HTTPS, abre su dirección en Chrome para Android y elige **Instalar aplicación** o **Añadir a pantalla de inicio** en el menú del navegador. Una vez cargada, la aplicación guarda sus archivos de interfaz para poder abrirlos sin conexión. Si se empaqueta para Android Studio, configura y valida el acceso a archivos STL y a la red local en el contenedor Android; las políticas de seguridad del WebView pueden impedir conexiones HTTP a Moonraker desde una página HTTPS.

## Funciones actuales

- Pestañas **LAMINADOR 3D** y **MI IMPRESORA** dentro de la app.
- Guarda varias impresoras localmente con nombre, IP/URL y la configuración actual del laminador (perfil, volumen, firmware, temperaturas, velocidades y plantillas); puedes volver a cargar esa configuración al laminador.
- La pestaña **MI IMPRESORA** puede mostrar el panel web de una impresora dentro de la app en un iframe. Al conectar una impresora, la lista guardada se pliega para dar más espacio al panel y se puede desplegar con la flecha. Necesita una página web accesible desde la red y que permita incrustación; no transmite G-code ni proporciona controles/API de la impresora. Hay un enlace alternativo para abrir el panel fuera de la app si el navegador o la página lo bloquea.
- Importación de STL binario y ASCII, con límite de 250.000 triángulos.
- Selección de unidades del STL (mm, cm, pulgadas o metros); los archivos con dimensiones inferiores a 1 mm sugieren metros, ya que STL no almacena unidades.
- Vista 3D interactiva del modelo: arrastra para girar y usa la rueda o los botones para acercar y alejar.
- Vista 3D unificada con la vista de capas: desliza la barra para mostrar cómo se forma el modelo capa a capa.
- Cambio de filamento por capa: usa Mayús + clic en la barra de capas, elige el comando automático según Marlin/Klipper o escribe G-code personalizado; los comandos se insertan al inicio de la capa al laminar. Verifica que tu firmware y sus macros admitan el comando antes de imprimir.
- Opción para permitir cancelar objetos que fallen/despeguen durante una impresión Klipper: genera `EXCLUDE_OBJECT_DEFINE`, `EXCLUDE_OBJECT_START` y `EXCLUDE_OBJECT_END` por objeto, incluidos los duplicados. Requiere `[exclude_object]` en `printer.cfg` y una interfaz Klipper compatible; no funciona con perfiles Marlin ni aparta objetos de una impresión ya terminada.
- Para Klipper, el G-code envía `SET_PRINT_STATS_INFO TOTAL_LAYER` y `SET_PRINT_STATS_INFO CURRENT_LAYER` para actualizar el contador de capa del panel durante la impresión.
- Al conectar una impresora, comprueba si Moonraker está accesible y Klipper está listo. Después de laminar con el perfil Klipper aparece **Cargar e imprimir** junto a la descarga; confirma la acción para subir el G-code a `gcodes` y solicitar el inicio de la impresión mediante Moonraker.
- Duplicación de objetos con colocación automática en un espacio libre de la cama, selector de copia, cambio de color en la vista 3D y eliminación de copias. Cada copia conserva su propia escala, posición y rotación, y se incluye en el laminado. El color es visual solamente; el G-code generado es monocromático.
- Perfiles iniciales para Ender 3/Pro, Ender 3 V2, Ender 3 S1, Prusa i3 MK3S, Anycubic Kobra y BIQU B1, B1 SE Plus, BX y Hurakan, con dimensiones de cama y plantillas editables de Marlin o llamadas a macros `START_PRINT`/`END_PRINT` de Klipper. Verifica el volumen real de tu variante antes de imprimir.
- Ajuste uniforme de escala, rotación en X/Y/Z y posición X/Y/Z; elige **Mover X/Y** o **Girar** y arrastra sobre el visor con clic derecho (o con un dedo en Android). El modo mover conserva fija la altura Z; en modo giro se elige el eje X, Y o Z directamente en el visor. También puedes introducir valores exactos o acostar la pieza sobre X o Y.
- Estimación de duración basada en los movimientos G0/G1 y sus velocidades. Es aproximada y no incluye calentamiento, pausas, aceleraciones reales ni el tiempo interno de macros de Klipper.
- Perfil básico configurable: tamaño de cama, altura de capa, boquilla, porcentaje de relleno lineal, diámetro de filamento, temperaturas y velocidad.
- Exportación de G-code con una pared exterior y relleno lineal.

## Límites importantes

Es una primera versión experimental, no un sustituto de Cura, PrusaSlicer u otro laminador maduro. El panel web se incrusta en un iframe, mientras que la subida e impresión usa la API de Moonraker en el equipo detectado; se necesita acceso a la red, CORS configurado para permitir el origen de esta app y un navegador que no bloquee HTTP local (si la app usa HTTPS, la petición a una impresora HTTP puede ser bloqueada). La integración actual no gestiona credenciales de Moonraker; una impresora que requiera autenticación necesita una configuración de acceso compatible con el origen de la app. Los perfiles son configuraciones iniciales, no perfiles oficiales verificados por fabricantes ni una conexión directa a la impresora. El modo Klipper llama a macros que deben existir en tu `printer.cfg`; la aplicación no puede leer la configuración de una impresora desconectada. La cancelación de objetos solo funciona con Klipper si `[exclude_object]` está habilitado y el panel de control implementa la exclusión; confirma que la interfaz de tu máquina ofrezca esta acción. El color de los objetos solo se muestra en la vista 3D y no produce cambios de filamento ni G-code multicolor. Para cambios por capa, Marlin propone `M600` y Klipper propone `PAUSE` para el cambio manual; el firmware de la máquina debe admitir o configurar estos comandos. El total está limitado a 500.000 triángulos entre objetos para controlar el uso de memoria. No genera soportes, múltiples paredes, capas sólidas superiores/inferiores, brim/raft, retracción ni compensación de boquilla; tampoco incluye comprobación completa de mallas. Revisa las dimensiones, el G-code y los comandos específicos de tu máquina en un laminador conocido antes de imprimir.

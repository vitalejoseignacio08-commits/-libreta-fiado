# Libreta de Fiado Digital

## Qué es este proyecto
App web instalable (PWA) para que comercios de pueblo lleven sus cuentas corrientes ("el fiado") desde el celular, en lugar del cuaderno de papel.

**Clientes objetivo:** forrajerías, agronomías, ferreterías, corralones, veterinarias rurales y almacenes de pueblos del interior de Argentina. Venden a cuenta corriente y hoy lo anotan en papel: pierden plata por olvidos, hay discusiones con clientes y no saben cuánto tienen "en la calle".

**Modelo de negocio:** pago de instalación + mantenimiento mensual chico. La app se hace una vez y se vende a muchos comercios.

**Desarrollador:** José Ignacio, estudiante, empieza Ingeniería en Sistemas el año próximo. Está aprendiendo, así que necesita entender el código (ver "Cómo trabajar conmigo").

## Versión 1 (alcance)

### Pantallas
1. **Inicio**
   - Arriba, grande: "Tenés $X en la calle" (suma de todos los saldos).
   - Buscador de clientes.
   - Lista de clientes ordenada por deuda (mayor primero), con aviso de color si hace mucho que no pagan (ej. más de 30 días sin pagos).
   - Botón "+ Nuevo cliente".
2. **Ficha del cliente**
   - Nombre, teléfono, saldo actual.
   - Historial de movimientos (fecha, detalle, monto). Fiados y pagos con colores distintos.
   - Botones "+ Fiado" y "+ Pago".
   - Botón "Enviar resumen por WhatsApp": abre WhatsApp (link wa.me, sin API) con un mensaje armado: saldo y últimos movimientos, firmado con el nombre del negocio.
3. **Cargar movimiento**
   - Monto, detalle opcional, fecha (hoy por defecto).
   - Tiene que ser MÁS RÁPIDO que anotar en el cuaderno. Mínimos toques.
4. **Nuevo cliente**
   - Nombre, teléfono (formato argentino), nota opcional (campo, zona, etc.).
5. **Ajustes**
   - Nombre del negocio (aparece en los mensajes de WhatsApp).
   - Copia de seguridad: exportar e importar todos los datos en un archivo JSON.

### Fuera de la versión 1 (NO implementar todavía)
Varios usuarios, nube/sincronización, stock, facturación, recordatorios automáticos, intereses por mora, login.

## Decisiones técnicas
- HTML + CSS + JavaScript puro (sin frameworks), para que José pueda entender todo el código.
- PWA instalable: manifest.json + service worker. Debe funcionar SIN internet (comercios rurales con mala señal).
- Datos guardados en el celular (localStorage para v1). Envolver lecturas/escrituras en try/catch.
- Montos en pesos argentinos, formato $ 12.345 (punto de miles). Fechas en formato dd/mm/aaaa.
- Diseño mobile-first, botones grandes, letra legible. Usuarios no técnicos, a veces mayores.
- Hosting gratuito (GitHub Pages, Netlify o Cloudflare Pages).
- Datos de ejemplo para la demo: negocio "Forrajería San José" con clientes inventados.

## Estructura sugerida
```
index.html
styles.css
app.js
manifest.json
service-worker.js
icons/
```

## Cómo trabajar conmigo
- Respondé en español.
- Avanzá en pasos chicos: una funcionalidad por vez, que yo pueda probar antes de seguir.
- Después de cada cambio, explicame en pocas líneas qué hiciste y por qué, en lenguaje simple.
- Comentá el código en español en las partes importantes.
- Si algo que pido no conviene o no es viable, decímelo directo antes de hacerlo.
- Al terminar cada paso, actualizá la sección "Progreso" de este archivo.

## Progreso
- [x] Estructura base y pantalla de inicio
- [x] Nuevo cliente
- [x] Ficha del cliente y carga de movimientos
- [x] Resumen por WhatsApp
- [x] Ajustes y copia de seguridad
- [x] PWA instalable y funcionamiento sin internet
- [x] Datos de ejemplo para la demo
- [x] Publicación — https://vitalejoseignacio08-commits.github.io/-libreta-fiado/

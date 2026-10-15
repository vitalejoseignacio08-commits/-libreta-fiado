/* ===========================================
   datos.js - Lógica de datos de Cuentas Claras,
   compartida entre la app del celular y el panel
   de escritorio.

   Acá vive todo lo que NO depende de cómo se ve
   cada pantalla: cálculo de saldos, validaciones,
   formato de moneda/fecha, y las primitivas para
   leer/guardar en localStorage. Cada app sigue
   teniendo su propia interfaz, sus propias claves
   de localStorage y su propia forma de avisarle
   al usuario si algo sale mal — eso se queda en
   cada app.js, este archivo no toca el DOM.

   Se carga con un <script> ANTES del app.js de
   cada pantalla (tanto index.html como
   escritorio/index.html).
   =========================================== */

/* -------------------------------------------
   Primitivas de guardado en localStorage
   ------------------------------------------- */

// Lee y parsea un valor JSON guardado bajo una clave.
// Devuelve { ok: true, datos } si no había nada guardado (datos: null)
// o si se pudo leer y parsear bien. Devuelve { ok: false, crudo } si
// había algo guardado pero no es JSON válido (datos corruptos) — así
// cada app decide qué hacer en ese caso sin perder esa distinción
// (por ejemplo: no sobrescribir nada, avisar y ofrecer un backup).
function leerJSONDeStorage(clave) {
  let crudo;
  try {
    crudo = localStorage.getItem(clave);
  } catch (error) {
    console.error(`Error al leer "${clave}" de localStorage:`, error);
    return { ok: true, datos: null };
  }

  if (crudo === null) return { ok: true, datos: null };

  try {
    return { ok: true, datos: JSON.parse(crudo) };
  } catch (error) {
    console.error(`"${clave}" tiene datos corruptos en localStorage:`, error);
    return { ok: false, crudo };
  }
}

// Guarda un valor como JSON bajo una clave. Devuelve true/false según
// si se pudo guardar (puede fallar por espacio lleno o modo privado
// estricto del navegador).
function guardarJSONEnStorage(clave, valor) {
  try {
    localStorage.setItem(clave, JSON.stringify(valor));
    return true;
  } catch (error) {
    console.error(`Error al guardar "${clave}" en localStorage:`, error);
    return false;
  }
}

/* -------------------------------------------
   Estructura de datos
   ------------------------------------------- */

// Estructura vacía: así arranca un negocio real la primera vez
function datosVacios() {
  return {
    negocio: {
      nombre: "",
    },
    clientes: [],
  };
}

// Alcanza con esto para una app que guarda los datos en un solo
// dispositivo (no hace falta un ID globalmente único todavía)
function generarId() {
  return Date.now().toString();
}

// Chequea que el objeto tenga la forma exacta que espera la app,
// campo por campo, para no romper la pantalla con un archivo corrupto
// o de otra app. La usan tanto el import de backup como, en el
// futuro, cualquier chequeo de integridad de los datos guardados.
function estructuraDeDatosEsValida(datos) {
  if (typeof datos !== "object" || datos === null) return false;
  if (typeof datos.negocio !== "object" || datos.negocio === null) return false;
  if (typeof datos.negocio.nombre !== "string") return false;
  if (!Array.isArray(datos.clientes)) return false;

  return datos.clientes.every((cliente) => {
    if (typeof cliente !== "object" || cliente === null) return false;
    if (typeof cliente.id !== "string") return false;
    if (typeof cliente.nombre !== "string") return false;
    if (typeof cliente.telefono !== "string") return false;
    if (typeof cliente.nota !== "string") return false;
    if (!Array.isArray(cliente.movimientos)) return false;

    return cliente.movimientos.every((mov) => {
      if (typeof mov !== "object" || mov === null) return false;
      if (typeof mov.id !== "string") return false;
      if (mov.tipo !== "fiado" && mov.tipo !== "pago") return false;
      if (typeof mov.monto !== "number") return false;
      if (typeof mov.detalle !== "string") return false;
      if (typeof mov.fecha !== "string") return false;
      return true;
    });
  });
}

/* -------------------------------------------
   Cálculos sobre un cliente
   ------------------------------------------- */

// Saldo = total fiado - total pagado. Nunca se guarda como número
// aparte: siempre se recalcula a partir de los movimientos.
function calcularSaldo(cliente) {
  return cliente.movimientos.reduce((saldo, mov) => {
    return mov.tipo === "fiado" ? saldo + mov.monto : saldo - mov.monto;
  }, 0);
}

// Convierte una fecha guardada como "aaaa-mm-dd" a un Date en el huso
// horario local (a medianoche). OJO: "new Date('aaaa-mm-dd')" directo
// la interpreta en UTC, y en Argentina (UTC-3) eso puede mostrar el
// día anterior al correcto. Por eso armamos el Date a mano.
function fechaISOaDate(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-").map(Number);
  return new Date(anio, mes - 1, dia);
}

// Fecha del último pago (o null si nunca pagó)
function fechaUltimoPago(cliente) {
  const pagos = cliente.movimientos.filter((m) => m.tipo === "pago");
  if (pagos.length === 0) return null;
  const fechas = pagos.map((p) => fechaISOaDate(p.fecha));
  return new Date(Math.max(...fechas));
}

// ¿Hace más de 15 días que no paga?
function estaAtrasado(cliente) {
  const ultimoPago = fechaUltimoPago(cliente);
  // Si nunca pagó, usamos la fecha del primer fiado como referencia
  const primerFiado = cliente.movimientos[0]?.fecha;
  const fechaReferencia = ultimoPago || (primerFiado && fechaISOaDate(primerFiado));
  if (!fechaReferencia || isNaN(fechaReferencia)) return false;

  const hoy = new Date();
  const diasSinPagar = (hoy - fechaReferencia) / (1000 * 60 * 60 * 24);
  return diasSinPagar > 15;
}

/* -------------------------------------------
   Validaciones
   ------------------------------------------- */

// Teléfono argentino: código de área + número, sin el 0 ni el 15,
// son 10 números en total (ej: 11 2233 4455, o 341 155 1234). El
// campo es opcional, así que vacío también es válido.
function telefonoEsValido(telefono) {
  const limpio = telefono.replace(/\D/g, "");
  if (limpio === "") return true;
  return limpio.length === 10;
}

// Busca si ya existe otro cliente con ese nombre (sin distinguir
// mayúsculas/espacios), para avisar antes de crear un duplicado por
// error. "excluirId" es para no compararse contra sí mismo al editar.
function existeClienteConNombre(datos, nombre, excluirId) {
  const nombreNormalizado = nombre.trim().toLowerCase();
  return datos.clientes.some(
    (cliente) => cliente.id !== excluirId && cliente.nombre.trim().toLowerCase() === nombreNormalizado
  );
}

/* -------------------------------------------
   Formato de moneda y fecha (es-AR)
   ------------------------------------------- */

// $ 12.345 (punto de miles, sin decimales)
function formatearMonto(numero) {
  const redondeado = Math.round(numero);
  return `$ ${redondeado.toLocaleString("es-AR")}`;
}

// Fecha guardada como "aaaa-mm-dd" (formato de <input type="date">)
// mostrada como dd/mm/aaaa
function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Igual que formatearFecha, pero a partir de un objeto Date
// (lo usan fechaUltimoPago y otras funciones que ya devuelven un Date)
function formatearFechaDesdeDate(fecha) {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

// Fecha de hoy en formato "aaaa-mm-dd", para precargar inputs de
// fecha o nombrar archivos exportados
function fechaDeHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// Evita que texto escrito por el usuario (nombre, detalle, nota) rompa
// la pantalla si alguien pone símbolos como < o & en un campo.
function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

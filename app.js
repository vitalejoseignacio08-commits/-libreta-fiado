/* ===========================================
   app.js - Lógica de la Libreta de Fiado
   Por ahora: Pantalla de Inicio + datos de ejemplo
   =========================================== */

const CLAVE_STORAGE = "libreta-fiado-datos";
const CLAVE_ACTIVACION = "libreta-fiado-activado";
const CLAVE_TEMA = "libreta-fiado-tema";
const CLAVE_ULTIMO_BACKUP = "libreta-fiado-ultimo-backup";
const CLAVE_BIENVENIDA_VISTA = "libreta-fiado-bienvenida-vista";

// Si pasaron más de estos días sin exportar una copia de seguridad,
// se lo recordamos al dueño del negocio en la pantalla de Inicio.
const DIAS_PARA_AVISAR_BACKUP = 7;

// Código numérico único para activar la app. Es el mismo para todos
// los negocios a los que se la vendas (no hace falta uno por cliente).
const CODIGO_ACTIVACION = "769246";

// Techo para el monto de un fiado/pago, para avisar si alguien
// se equivoca de ceros al escribir (ej. 100 millones de pesos)
const LIMITE_MONTO = 100000000;

// Guardan en qué cliente y qué tipo de movimiento estamos trabajando
// mientras navegamos entre pantallas
let clienteActualId = null;
let tipoMovimientoActual = null; // "fiado" o "pago"
let clienteEditandoId = null; // si no es null, el form de cliente está editando (no creando)
let movimientoEditandoId = null; // si no es null, el form de movimiento está editando (no creando)
let pantallaOrigenMovimiento = "pantalla-ficha-cliente"; // a dónde volver al guardar/cancelar un movimiento

/* -------------------------------------------
   Datos de ejemplo para la demo
   (sólo se usan si todavía no hay nada guardado)
   ------------------------------------------- */
function datosDeEjemplo() {
  return {
    negocio: {
      nombre: "Forrajería San José",
    },
    clientes: [
      {
        id: "1",
        nombre: "Don Ramón",
        telefono: "5491122334455",
        nota: "Campo La Esperanza",
        movimientos: [
          { id: "m1", tipo: "fiado", monto: 15000, detalle: "Bolsa de maíz", fecha: "2026-08-20" },
          { id: "m2", tipo: "fiado", monto: 8000, detalle: "Alambre", fecha: "2026-09-05" },
        ],
      },
      {
        id: "2",
        nombre: "María Gómez",
        telefono: "5491133445566",
        nota: "",
        movimientos: [
          { id: "m3", tipo: "fiado", monto: 5000, detalle: "Balanceado perros", fecha: "2026-09-28" },
          { id: "m4", tipo: "pago", monto: 2000, detalle: "", fecha: "2026-10-01" },
        ],
      },
      {
        id: "3",
        nombre: "Carlos Pérez",
        telefono: "5491144556677",
        nota: "Paga los viernes",
        movimientos: [
          { id: "m5", tipo: "fiado", monto: 3000, detalle: "Semillas", fecha: "2026-10-05" },
        ],
      },
    ],
  };
}

/* -------------------------------------------
   Guardar y leer datos en localStorage
   (las primitivas de lectura/escritura están en
   datos.js, compartidas con el panel de escritorio;
   acá solo queda la política propia del celular:
   auto-inicializar vacío la primera vez, y avisar
   con un modal si falla el guardado)
   ------------------------------------------- */
function leerDatos() {
  const resultado = leerJSONDeStorage(CLAVE_STORAGE);

  if (!resultado.ok) {
    // JSON corrupto: no sobrescribimos nada (se podría recuperar a
    // mano revisando localStorage), solo mostramos vacío en memoria.
    return datosVacios();
  }
  if (resultado.datos === null) {
    const vacio = datosVacios();
    guardarDatos(vacio);
    return vacio;
  }
  return resultado.datos;
}

function guardarDatos(datos) {
  const ok = guardarJSONEnStorage(CLAVE_STORAGE, datos);
  if (!ok) avisarErrorDeGuardado();
  return ok;
}

// Si el navegador bloquea el almacenamiento (modo privado estricto,
// configuración de privacidad), hoy en día nada avisa y el usuario
// puede creer que guardó cuando en realidad no se guardó nada. Esto
// lo deja bien visible en el momento en que falla.
let avisoErrorGuardadoAbierto = false;
function avisarErrorDeGuardado() {
  if (avisoErrorGuardadoAbierto) return;
  avisoErrorGuardadoAbierto = true;

  mostrarAlerta(
    "No se pudo guardar este cambio en el celular.\n\nEs probable que el navegador esté bloqueando el almacenamiento (modo incógnito o configuración de privacidad). Lo que acabás de hacer puede perderse si cerrás la app.\n\nProbá abrirla en modo normal (no incógnito), o revisá los permisos de almacenamiento del navegador."
  ).then(() => {
    avisoErrorGuardadoAbierto = false;
  });
}

/* -------------------------------------------
   Activación con código numérico
   (se guarda separado de los datos del negocio,
   así no se borra si se importa/exporta backup)
   ------------------------------------------- */
function estaActivado() {
  try {
    return localStorage.getItem(CLAVE_ACTIVACION) === "true";
  } catch (error) {
    console.error("Error al leer el estado de activación:", error);
    return false;
  }
}

function activarApp() {
  try {
    localStorage.setItem(CLAVE_ACTIVACION, "true");
  } catch (error) {
    console.error("Error al guardar la activación:", error);
    avisarErrorDeGuardado();
  }
}

/* -------------------------------------------
   Pantalla de bienvenida: se muestra una sola
   vez, la primera vez que se activa la app
   ------------------------------------------- */
function bienvenidaVista() {
  try {
    return localStorage.getItem(CLAVE_BIENVENIDA_VISTA) === "true";
  } catch (error) {
    console.error("Error al leer si se vio la bienvenida:", error);
    return true; // si falla, no molestamos con la bienvenida de nuevo
  }
}

function marcarBienvenidaVista() {
  try {
    localStorage.setItem(CLAVE_BIENVENIDA_VISTA, "true");
  } catch (error) {
    console.error("Error al guardar que se vio la bienvenida:", error);
  }
}

// Después de activar (o al abrir la app ya activada), decide si toca
// mostrar la bienvenida o ir directo a Inicio
function irAInicioOBienvenida() {
  if (!bienvenidaVista()) {
    mostrarPantalla("pantalla-bienvenida");
  } else {
    renderizarInicio();
    mostrarPantalla("pantalla-inicio");
  }
}

/* -------------------------------------------
   Modo oscuro (se guarda aparte, es una
   preferencia del dispositivo, no un dato del negocio)
   ------------------------------------------- */
function obtenerTema() {
  try {
    return localStorage.getItem(CLAVE_TEMA) === "oscuro" ? "oscuro" : "claro";
  } catch (error) {
    console.error("Error al leer el tema guardado:", error);
    return "claro";
  }
}

function aplicarTema(tema) {
  if (tema === "oscuro") {
    document.documentElement.setAttribute("data-theme", "oscuro");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

function guardarTema(tema) {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch (error) {
    console.error("Error al guardar el tema:", error);
  }
}

/* -------------------------------------------
   Cálculos, validaciones y formato de moneda/fecha:
   ver datos.js (compartido con el escritorio)
   ------------------------------------------- */
function buscarClientePorId(id) {
  const datos = leerDatos();
  return datos.clientes.find((cliente) => cliente.id === id);
}

/* -------------------------------------------
   Resumen por WhatsApp
   ------------------------------------------- */

// Deja sólo los números y le agrega el prefijo 549 (Argentina + celular)
// si el usuario no lo puso. Así funciona el link de WhatsApp sin usar su API.
function normalizarTelefonoWhatsapp(telefono) {
  let limpio = telefono.replace(/\D/g, "");
  if (limpio.startsWith("549")) return limpio;
  if (limpio.startsWith("54")) return "549" + limpio.slice(2);
  if (limpio.startsWith("0")) limpio = limpio.slice(1);
  return "549" + limpio;
}

function armarMensajeResumen(cliente, nombreNegocio) {
  const saldo = calcularSaldo(cliente);

  // Últimos 5 movimientos, del más viejo al más nuevo para que se lea como historia
  const ultimosMovimientos = [...cliente.movimientos]
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5)
    .reverse();

  let mensaje = `Hola ${cliente.nombre}! Te paso tu resumen de cuenta en ${nombreNegocio}:\n\n`;
  mensaje += `Saldo actual: ${formatearMonto(saldo)}\n`;

  if (ultimosMovimientos.length > 0) {
    mensaje += `\nÚltimos movimientos:\n`;
    ultimosMovimientos.forEach((mov) => {
      const signo = mov.tipo === "fiado" ? "+" : "-";
      const detalle = mov.detalle ? `: ${mov.detalle}` : "";
      mensaje += `${formatearFecha(mov.fecha)}${detalle} ${signo} ${formatearMonto(mov.monto)}\n`;
    });
  }

  mensaje += `\nGracias por tu confianza!`;
  return mensaje;
}

function enviarResumenPorWhatsapp(cliente) {
  const datos = leerDatos();
  const nombreNegocio = datos.negocio?.nombre || "nuestro negocio";

  if (!cliente.telefono) {
    mostrarAlerta("Este cliente no tiene un teléfono guardado.");
    return;
  }

  const telefono = normalizarTelefonoWhatsapp(cliente.telefono);
  const mensaje = armarMensajeResumen(cliente, nombreNegocio);
  const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

  window.open(url, "_blank");
}

/* -------------------------------------------
   Ajustes: nombre del negocio
   ------------------------------------------- */
function renderizarAjustes() {
  const datos = leerDatos();
  document.getElementById("input-nombre-negocio").value = datos.negocio?.nombre || "";
}

function guardarNombreNegocio(nombre) {
  const datos = leerDatos();
  datos.negocio.nombre = nombre.trim();
  guardarDatos(datos);
}

/* -------------------------------------------
   Demo: carga a pedido los clientes inventados,
   solo para mostrar la app (no se usa más
   automáticamente al abrir por primera vez)
   ------------------------------------------- */
function cargarDatosDeEjemplo() {
  guardarDatos(datosDeEjemplo());
}

/* -------------------------------------------
   Resumen legible (.txt) - para que el dueño del
   negocio lo pueda abrir y leer sin nada técnico
   ------------------------------------------- */
function generarResumenLegible() {
  const datos = leerDatos();
  const nombreNegocio = datos.negocio?.nombre || "Mi negocio";

  // Mismo orden que la pantalla de Inicio: mayor deuda primero
  const clientesOrdenados = [...datos.clientes].sort(
    (a, b) => calcularSaldo(b) - calcularSaldo(a)
  );

  const totalEnCalle = clientesOrdenados.reduce(
    (total, cliente) => total + calcularSaldo(cliente),
    0
  );

  let texto = `${nombreNegocio}\n`;
  texto += `Resumen de cuentas - ${formatearFecha(fechaDeHoyISO())}\n`;
  texto += `========================================\n\n`;
  texto += `TOTAL EN LA CALLE: ${formatearMonto(totalEnCalle)}\n\n`;

  if (clientesOrdenados.length === 0) {
    texto += `No hay clientes cargados todavía.\n`;
    return texto;
  }

  clientesOrdenados.forEach((cliente) => {
    const saldo = calcularSaldo(cliente);
    texto += `----------------------------------------\n`;
    texto += `${cliente.nombre}\n`;
    if (cliente.telefono) texto += `Teléfono: ${cliente.telefono}\n`;
    texto += `Debe: ${formatearMonto(saldo)}\n`;

    if (cliente.movimientos.length > 0) {
      texto += `Movimientos:\n`;
      const movimientosOrdenados = [...cliente.movimientos].sort(
        (a, b) => new Date(a.fecha) - new Date(b.fecha)
      );
      movimientosOrdenados.forEach((mov) => {
        const signo = mov.tipo === "fiado" ? "+" : "-";
        const detalle = mov.detalle ? ` (${mov.detalle})` : "";
        texto += `  ${formatearFecha(mov.fecha)}${detalle}: ${signo} ${formatearMonto(mov.monto)}\n`;
      });
    }
    texto += `\n`;
  });

  return texto;
}

function exportarResumenLegible() {
  const texto = generarResumenLegible();
  const archivo = new Blob([texto], { type: "text/plain" });

  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `resumen-clientes-${fechaDeHoyISO()}.txt`;
  enlace.click();

  URL.revokeObjectURL(enlace.href);
}

/* -------------------------------------------
   Copia de seguridad: exportar e importar JSON
   ------------------------------------------- */

// Registra cuándo fue la última vez que se exportó un backup,
// para poder avisar en Inicio si hace mucho que no se hace uno.
function guardarFechaUltimoBackup() {
  try {
    localStorage.setItem(CLAVE_ULTIMO_BACKUP, fechaDeHoyISO());
  } catch (error) {
    console.error("Error al guardar la fecha del último backup:", error);
  }
}

// Cuántos días pasaron desde el último backup, o null si nunca se hizo uno
function diasDesdeUltimoBackup() {
  try {
    const fechaGuardada = localStorage.getItem(CLAVE_ULTIMO_BACKUP);
    if (!fechaGuardada) return null;

    const hoy = new Date();
    const ultimoBackup = fechaISOaDate(fechaGuardada);
    return Math.floor((hoy - ultimoBackup) / (1000 * 60 * 60 * 24));
  } catch (error) {
    console.error("Error al leer la fecha del último backup:", error);
    return null;
  }
}

function exportarDatos() {
  const datos = leerDatos();
  const contenido = JSON.stringify(datos, null, 2);
  const archivo = new Blob([contenido], { type: "application/json" });

  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `libreta-fiado-backup-${fechaDeHoyISO()}.json`;
  enlace.click();

  URL.revokeObjectURL(enlace.href);
  guardarFechaUltimoBackup();
}

function importarDatos(archivo) {
  const lector = new FileReader();

  lector.onload = async () => {
    try {
      const datosImportados = JSON.parse(lector.result);

      if (!estructuraDeDatosEsValida(datosImportados)) {
        mostrarAlerta(
          "El archivo no tiene el formato correcto de una copia de seguridad de Cuentas Claras."
        );
        return;
      }

      const confirmar = await mostrarConfirmacion(
        "Esto va a reemplazar todos los datos actuales por los del archivo. ¿Continuar?"
      );
      if (!confirmar) return;

      guardarDatos(datosImportados);
      renderizarInicio();
      renderizarAjustes();
      mostrarAlerta("Datos importados correctamente.");
    } catch (error) {
      console.error("Error al importar datos:", error);
      mostrarAlerta("No se pudo leer el archivo. ¿Es una copia de seguridad válida?");
    }
  };

  lector.readAsText(archivo);
}

/* -------------------------------------------
   Render de la Pantalla de Inicio
   ------------------------------------------- */
function renderizarInicio(filtro = "") {
  const datos = leerDatos();
  const lista = document.getElementById("lista-clientes");
  const avisoVacio = document.getElementById("aviso-vacio");
  const montoTotal = document.getElementById("monto-total");
  const avisoBackup = document.getElementById("aviso-backup");

  // Si hay clientes cargados y hace tiempo (o nunca) que no se exporta
  // un backup, se lo recordamos: es la única copia fuera del celular.
  const dias = diasDesdeUltimoBackup();
  const haceFaltaAvisar =
    datos.clientes.length > 0 && (dias === null || dias >= DIAS_PARA_AVISAR_BACKUP);
  avisoBackup.hidden = !haceFaltaAvisar;

  // Total "en la calle" = suma de todos los saldos
  const totalEnCalle = datos.clientes.reduce(
    (total, cliente) => total + calcularSaldo(cliente),
    0
  );
  montoTotal.textContent = formatearMonto(totalEnCalle);

  // Filtrar por nombre si hay texto en el buscador
  const filtroNormalizado = filtro.trim().toLowerCase();
  const clientesFiltrados = datos.clientes.filter((cliente) =>
    cliente.nombre.toLowerCase().includes(filtroNormalizado)
  );

  // Ordenar por deuda, de mayor a menor
  clientesFiltrados.sort((a, b) => calcularSaldo(b) - calcularSaldo(a));

  // Pintar la lista
  lista.innerHTML = "";

  if (clientesFiltrados.length === 0) {
    avisoVacio.hidden = false;
  } else {
    avisoVacio.hidden = true;

    clientesFiltrados.forEach((cliente, indice) => {
      const saldo = calcularSaldo(cliente);
      const atrasado = estaAtrasado(cliente);

      const ultimoPago = fechaUltimoPago(cliente);
      const textoUltimoPago = ultimoPago
        ? `Último pago: ${formatearFechaDesdeDate(ultimoPago)}`
        : "Todavía no pagó nada";

      const item = document.createElement("li");
      item.className = "item-cliente" + (atrasado ? " atrasado" : "");
      item.style.animationDelay = `${indice * 40}ms`;
      item.innerHTML = `
        <span class="datos-cliente">
          <span class="nombre-cliente">${escaparHtml(cliente.nombre)}</span>
          <span class="fecha-ultimo-pago-cliente">${textoUltimoPago}</span>
          <span class="saldo-cliente">${formatearMonto(saldo)}</span>
        </span>
        <button type="button" class="boton-cobrar-rapido" title="Registrar un pago">
          + Pago
        </button>
      `;
      item.addEventListener("click", () => {
        clienteActualId = cliente.id;
        renderizarFicha();
        mostrarPantalla("pantalla-ficha-cliente");
      });
      // El botón "+ Pago" va directo a cargar el pago, sin pasar por la
      // ficha completa. Frena el click para que no abra la ficha también.
      item.querySelector(".boton-cobrar-rapido").addEventListener("click", (evento) => {
        evento.stopPropagation();
        clienteActualId = cliente.id;
        abrirCargarMovimiento("pago", "pantalla-inicio");
      });
      lista.appendChild(item);
    });
  }
}

/* -------------------------------------------
   Render de la Ficha del Cliente
   ------------------------------------------- */
function renderizarFicha() {
  const cliente = buscarClientePorId(clienteActualId);
  if (!cliente) return;

  document.getElementById("ficha-nombre").textContent = cliente.nombre;
  document.getElementById("ficha-telefono").textContent = cliente.telefono || "";
  document.getElementById("ficha-saldo").textContent = formatearMonto(calcularSaldo(cliente));

  const lista = document.getElementById("lista-movimientos");
  const avisoVacio = document.getElementById("aviso-sin-movimientos");
  lista.innerHTML = "";

  if (cliente.movimientos.length === 0) {
    avisoVacio.hidden = false;
  } else {
    avisoVacio.hidden = true;

    // Más reciente primero
    const movimientosOrdenados = [...cliente.movimientos].sort(
      (a, b) => new Date(b.fecha) - new Date(a.fecha)
    );

    movimientosOrdenados.forEach((mov, indice) => {
      const signo = mov.tipo === "fiado" ? "+" : "-";
      const detalleMostrado = mov.detalle || (mov.tipo === "fiado" ? "Fiado" : "Pago");
      const item = document.createElement("li");
      item.className = "item-movimiento " + mov.tipo;
      item.style.animationDelay = `${indice * 40}ms`;
      item.innerHTML = `
        <span class="info-movimiento">
          <span class="detalle-movimiento">${escaparHtml(detalleMostrado)}</span>
          <span class="fecha-movimiento">${formatearFecha(mov.fecha)}</span>
        </span>
        <span class="monto-movimiento">${signo} ${formatearMonto(mov.monto)}</span>
      `;
      // Tocar un movimiento lo abre para corregirlo o borrarlo
      item.addEventListener("click", () => {
        abrirEditarMovimiento(mov);
      });
      lista.appendChild(item);
    });
  }
}

/* -------------------------------------------
   Modal genérico: reemplaza los alert()/confirm()
   del navegador por ventanitas con el estilo de la app.
   Devuelven una Promise, así se pueden usar con await.
   ------------------------------------------- */
function abrirModal(mensaje, botones) {
  return new Promise((resolve) => {
    const overlay = document.getElementById("overlay-modal");
    const contenedorBotones = document.getElementById("modal-botones");

    document.getElementById("modal-mensaje").textContent = mensaje;
    contenedorBotones.innerHTML = "";

    botones.forEach((boton) => {
      const elementoBoton = document.createElement("button");
      elementoBoton.type = "button";
      elementoBoton.className = boton.clase;
      elementoBoton.textContent = boton.texto;
      elementoBoton.addEventListener("click", () => {
        overlay.hidden = true;
        resolve(boton.valor);
      });
      contenedorBotones.appendChild(elementoBoton);
    });

    overlay.hidden = false;
  });
}

// Reemplazo de alert(): un solo botón para aceptar
function mostrarAlerta(mensaje) {
  return abrirModal(mensaje, [{ texto: "Aceptar", clase: "boton-principal", valor: true }]);
}

// Reemplazo de confirm(): Cancelar o Confirmar. Se usa con "await".
function mostrarConfirmacion(mensaje) {
  return abrirModal(mensaje, [
    { texto: "Cancelar", clase: "boton-secundario", valor: false },
    { texto: "Confirmar", clase: "boton-peligro", valor: true },
  ]);
}

/* -------------------------------------------
   Navegación simple entre pantallas
   (todas viven en el mismo index.html,
   se muestra una y se ocultan las demás)
   ------------------------------------------- */
function mostrarPantalla(idPantalla) {
  document.querySelectorAll(".pantalla").forEach((pantalla) => {
    const esLaQueSeMuestra = pantalla.id === idPantalla;
    pantalla.hidden = !esLaQueSeMuestra;

    if (esLaQueSeMuestra) {
      // Reiniciamos la animación de entrada cada vez (aunque sea la
      // misma pantalla), forzando un "reflow" entre quitarla y ponerla
      pantalla.classList.remove("animar-entrada");
      void pantalla.offsetWidth;
      pantalla.classList.add("animar-entrada");
    }
  });

  // El botón flotante sólo tiene sentido en la pantalla de Inicio
  const botonNuevoCliente = document.getElementById("boton-nuevo-cliente");
  botonNuevoCliente.hidden = idPantalla !== "pantalla-inicio";
}

/* -------------------------------------------
   Agregar un cliente nuevo
   ------------------------------------------- */
function agregarCliente(nombre, telefono, nota) {
  const datos = leerDatos();

  datos.clientes.push({
    id: generarId(),
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    nota: nota.trim(),
    movimientos: [],
  });

  guardarDatos(datos);
}

function editarCliente(id, nombre, telefono, nota) {
  const datos = leerDatos();
  const cliente = datos.clientes.find((c) => c.id === id);
  if (!cliente) return;

  cliente.nombre = nombre.trim();
  cliente.telefono = telefono.trim();
  cliente.nota = nota.trim();

  guardarDatos(datos);
}

function eliminarCliente(id) {
  const datos = leerDatos();
  datos.clientes = datos.clientes.filter((c) => c.id !== id);
  guardarDatos(datos);
}

/* -------------------------------------------
   Agregar, editar y eliminar movimientos (fiado o pago)
   ------------------------------------------- */
function agregarMovimiento(clienteId, tipo, monto, detalle, fecha) {
  const datos = leerDatos();
  const cliente = datos.clientes.find((c) => c.id === clienteId);
  if (!cliente) return;

  cliente.movimientos.push({
    id: generarId(),
    tipo,
    monto,
    detalle: detalle.trim(),
    fecha,
  });

  guardarDatos(datos);
}

function editarMovimiento(clienteId, movimientoId, monto, detalle, fecha) {
  const datos = leerDatos();
  const cliente = datos.clientes.find((c) => c.id === clienteId);
  if (!cliente) return;

  const movimiento = cliente.movimientos.find((m) => m.id === movimientoId);
  if (!movimiento) return;

  movimiento.monto = monto;
  movimiento.detalle = detalle.trim();
  movimiento.fecha = fecha;

  guardarDatos(datos);
}

function eliminarMovimiento(clienteId, movimientoId) {
  const datos = leerDatos();
  const cliente = datos.clientes.find((c) => c.id === clienteId);
  if (!cliente) return;

  cliente.movimientos = cliente.movimientos.filter((m) => m.id !== movimientoId);
  guardarDatos(datos);
}

/* -------------------------------------------
   Abrir la pantalla de Cargar Movimiento,
   para uno nuevo o para editar uno existente
   ------------------------------------------- */
function abrirCargarMovimiento(tipo, origen = "pantalla-ficha-cliente") {
  tipoMovimientoActual = tipo;
  movimientoEditandoId = null;
  pantallaOrigenMovimiento = origen;

  // Si se abrió desde Inicio (cobro rápido), aclaramos de qué cliente
  // es, porque no se ve su ficha en pantalla.
  const cliente = buscarClientePorId(clienteActualId);
  const nombreCliente = origen === "pantalla-inicio" && cliente ? ` — ${cliente.nombre}` : "";
  document.getElementById("titulo-cargar-movimiento").textContent =
    (tipo === "fiado" ? "Nuevo fiado" : "Nuevo pago") + nombreCliente;

  document.getElementById("input-monto").value = "";
  document.getElementById("input-detalle").value = "";
  document.getElementById("input-fecha").value = fechaDeHoyISO();
  document.getElementById("error-cargar-movimiento").hidden = true;
  document.getElementById("boton-eliminar-movimiento").hidden = true;

  mostrarPantalla("pantalla-cargar-movimiento");
  document.getElementById("input-monto").focus();
}

function abrirEditarMovimiento(movimiento) {
  tipoMovimientoActual = movimiento.tipo;
  movimientoEditandoId = movimiento.id;
  pantallaOrigenMovimiento = "pantalla-ficha-cliente"; // editar solo se hace desde la ficha

  document.getElementById("titulo-cargar-movimiento").textContent =
    movimiento.tipo === "fiado" ? "Editar fiado" : "Editar pago";
  document.getElementById("input-monto").value = movimiento.monto;
  document.getElementById("input-detalle").value = movimiento.detalle;
  document.getElementById("input-fecha").value = movimiento.fecha;
  document.getElementById("error-cargar-movimiento").hidden = true;
  document.getElementById("boton-eliminar-movimiento").hidden = false;

  mostrarPantalla("pantalla-cargar-movimiento");
}

/* -------------------------------------------
   Conexión con la interfaz (eventos)
   ------------------------------------------- */
// Registra el service worker para que la app funcione sin internet
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  // --- Modo oscuro: aplicamos el guardado y sincronizamos el interruptor ---
  aplicarTema(obtenerTema());
  const checkboxTemaOscuro = document.getElementById("checkbox-tema-oscuro");
  checkboxTemaOscuro.checked = obtenerTema() === "oscuro";
  checkboxTemaOscuro.addEventListener("change", () => {
    const tema = checkboxTemaOscuro.checked ? "oscuro" : "claro";
    aplicarTema(tema);
    guardarTema(tema);
  });

  // --- Pantalla de Activación: si no está activada, no deja entrar ---
  if (!estaActivado()) {
    mostrarPantalla("pantalla-activacion");
  } else {
    irAInicioOBienvenida();
  }

  // --- Bienvenida: después de leerla, recién ahí se va a Inicio ---
  document.getElementById("boton-empezar-bienvenida").addEventListener("click", () => {
    marcarBienvenidaVista();
    renderizarInicio();
    mostrarPantalla("pantalla-inicio");
  });

  document.getElementById("form-activacion").addEventListener("submit", (evento) => {
    evento.preventDefault();

    const codigoIngresado = document
      .getElementById("input-codigo-activacion")
      .value.replace(/\D/g, ""); // deja sólo los números
    const errorElemento = document.getElementById("error-activacion");

    if (codigoIngresado === CODIGO_ACTIVACION) {
      activarApp();
      errorElemento.hidden = true;
      irAInicioOBienvenida();
    } else {
      errorElemento.textContent = "Código incorrecto. Revisá que esté bien escrito.";
      errorElemento.hidden = false;
    }
  });

  // --- Aviso de backup pendiente: tocarlo exporta la copia al toque ---
  document.getElementById("aviso-backup").addEventListener("click", () => {
    exportarDatos();
    mostrarAlerta("Copia de seguridad descargada. Guardala en un lugar seguro (Drive, email, etc).");
    renderizarInicio(document.getElementById("input-buscar").value);
  });

  const inputBuscar = document.getElementById("input-buscar");
  inputBuscar.addEventListener("input", (evento) => {
    renderizarInicio(evento.target.value);
  });

  const botonNuevoCliente = document.getElementById("boton-nuevo-cliente");
  botonNuevoCliente.addEventListener("click", () => {
    clienteEditandoId = null;
    document.getElementById("titulo-nuevo-cliente").textContent = "Nuevo cliente";
    document.getElementById("form-nuevo-cliente").reset();
    document.getElementById("boton-eliminar-cliente").hidden = true;
    mostrarPantalla("pantalla-nuevo-cliente");
  });

  // --- Editar cliente (desde la Ficha) ---
  document.getElementById("boton-editar-cliente").addEventListener("click", () => {
    const cliente = buscarClientePorId(clienteActualId);
    if (!cliente) return;

    clienteEditandoId = cliente.id;
    document.getElementById("titulo-nuevo-cliente").textContent = "Editar cliente";
    document.getElementById("input-nombre").value = cliente.nombre;
    document.getElementById("input-telefono").value = cliente.telefono;
    document.getElementById("input-nota").value = cliente.nota;
    document.getElementById("error-nuevo-cliente").hidden = true;
    document.getElementById("boton-eliminar-cliente").hidden = false;

    mostrarPantalla("pantalla-nuevo-cliente");
  });

  const botonCancelar = document.getElementById("boton-cancelar-nuevo-cliente");
  botonCancelar.addEventListener("click", () => {
    document.getElementById("form-nuevo-cliente").reset();
    document.getElementById("error-nuevo-cliente").hidden = true;

    if (clienteEditandoId) {
      renderizarFicha();
      mostrarPantalla("pantalla-ficha-cliente");
    } else {
      mostrarPantalla("pantalla-inicio");
    }
  });

  const formNuevoCliente = document.getElementById("form-nuevo-cliente");
  formNuevoCliente.addEventListener("submit", async (evento) => {
    evento.preventDefault();

    const nombre = document.getElementById("input-nombre").value;
    const telefono = document.getElementById("input-telefono").value;
    const nota = document.getElementById("input-nota").value;
    const errorElemento = document.getElementById("error-nuevo-cliente");

    if (nombre.trim() === "") {
      errorElemento.textContent = "Ingresá el nombre del cliente.";
      errorElemento.hidden = false;
      return;
    }

    if (!telefonoEsValido(telefono)) {
      errorElemento.textContent =
        "El teléfono no es válido. Tiene que tener 10 números: código de área + número, sin el 0 ni el 15 (ej: 11 2233 4455).";
      errorElemento.hidden = false;
      return;
    }

    if (existeClienteConNombre(leerDatos(), nombre, clienteEditandoId)) {
      const confirmar = await mostrarConfirmacion(
        `Ya existe un cliente llamado "${nombre.trim()}". ¿Querés guardarlo igual?`
      );
      if (!confirmar) return;
    }

    errorElemento.hidden = true;
    formNuevoCliente.reset();

    if (clienteEditandoId) {
      editarCliente(clienteEditandoId, nombre, telefono, nota);
      renderizarFicha();
      mostrarPantalla("pantalla-ficha-cliente");
    } else {
      agregarCliente(nombre, telefono, nota);
      renderizarInicio();
      mostrarPantalla("pantalla-inicio");
    }
  });

  // --- Eliminar cliente (solo visible cuando se está editando uno) ---
  document.getElementById("boton-eliminar-cliente").addEventListener("click", async () => {
    const confirmar = await mostrarConfirmacion(
      "¿Seguro que querés eliminar este cliente? Se borra todo su historial y no se puede deshacer."
    );
    if (!confirmar) return;

    eliminarCliente(clienteEditandoId);
    renderizarInicio();
    mostrarPantalla("pantalla-inicio");
  });

  // --- Volver de la Ficha del Cliente a Inicio ---
  const botonVolverFicha = document.getElementById("boton-volver-ficha");
  botonVolverFicha.addEventListener("click", () => {
    renderizarInicio();
    mostrarPantalla("pantalla-inicio");
  });

  // --- Enviar resumen por WhatsApp ---
  document.getElementById("boton-enviar-whatsapp").addEventListener("click", () => {
    const cliente = buscarClientePorId(clienteActualId);
    if (cliente) enviarResumenPorWhatsapp(cliente);
  });

  document.getElementById("boton-nuevo-fiado").addEventListener("click", () => {
    abrirCargarMovimiento("fiado", "pantalla-ficha-cliente");
  });

  document.getElementById("boton-nuevo-pago").addEventListener("click", () => {
    abrirCargarMovimiento("pago", "pantalla-ficha-cliente");
  });

  // Vuelve a la Ficha o a Inicio, según desde dónde se abrió el movimiento
  // (la ficha completa, o el "+ Pago" rápido de la lista de Inicio)
  function volverDeCargarMovimiento() {
    if (pantallaOrigenMovimiento === "pantalla-inicio") {
      renderizarInicio(document.getElementById("input-buscar").value);
      mostrarPantalla("pantalla-inicio");
    } else {
      renderizarFicha();
      mostrarPantalla("pantalla-ficha-cliente");
    }
  }

  // --- Cancelar carga de movimiento ---
  document.getElementById("boton-cancelar-movimiento").addEventListener("click", () => {
    volverDeCargarMovimiento();
  });

  // --- Guardar el movimiento (fiado o pago) ---
  const formCargarMovimiento = document.getElementById("form-cargar-movimiento");
  formCargarMovimiento.addEventListener("submit", (evento) => {
    evento.preventDefault();

    // Redondeamos a pesos enteros: la app no maneja centavos
    const monto = Math.round(Number(document.getElementById("input-monto").value));
    const detalle = document.getElementById("input-detalle").value;
    const fecha = document.getElementById("input-fecha").value;
    const errorElemento = document.getElementById("error-cargar-movimiento");

    if (!monto || monto <= 0) {
      errorElemento.textContent = "Ingresá un monto válido.";
      errorElemento.hidden = false;
      return;
    }

    if (monto > LIMITE_MONTO) {
      errorElemento.textContent = `El monto es demasiado grande. Revisá que no tenga ceros de más (el máximo es ${formatearMonto(LIMITE_MONTO)}).`;
      errorElemento.hidden = false;
      return;
    }

    if (!fecha) {
      errorElemento.textContent = "Ingresá una fecha.";
      errorElemento.hidden = false;
      return;
    }

    if (movimientoEditandoId) {
      editarMovimiento(clienteActualId, movimientoEditandoId, monto, detalle, fecha);
    } else {
      agregarMovimiento(clienteActualId, tipoMovimientoActual, monto, detalle, fecha);
    }

    volverDeCargarMovimiento();
  });

  // --- Eliminar movimiento (solo visible cuando se está editando uno) ---
  document.getElementById("boton-eliminar-movimiento").addEventListener("click", async () => {
    const confirmar = await mostrarConfirmacion("¿Seguro que querés eliminar este movimiento?");
    if (!confirmar) return;

    eliminarMovimiento(clienteActualId, movimientoEditandoId);
    volverDeCargarMovimiento();
  });

  // --- Ir a Ajustes y volver ---
  document.getElementById("boton-ir-ajustes").addEventListener("click", () => {
    renderizarAjustes();
    mostrarPantalla("pantalla-ajustes");
  });

  document.getElementById("boton-volver-ajustes").addEventListener("click", () => {
    mostrarPantalla("pantalla-inicio");
  });

  // --- Guardar nombre del negocio ---
  document.getElementById("form-ajustes").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const nombre = document.getElementById("input-nombre-negocio").value;
    guardarNombreNegocio(nombre);
    mostrarAlerta("Datos del negocio guardados.");
  });

  // --- Descargar resumen legible (.txt) ---
  document.getElementById("boton-exportar-resumen").addEventListener("click", () => {
    exportarResumenLegible();
  });

  // --- Exportar copia de seguridad ---
  document.getElementById("boton-exportar-datos").addEventListener("click", () => {
    exportarDatos();
  });

  // --- Importar copia de seguridad ---
  const inputImportarArchivo = document.getElementById("input-importar-archivo");
  document.getElementById("boton-importar-datos").addEventListener("click", () => {
    inputImportarArchivo.click();
  });

  inputImportarArchivo.addEventListener("change", (evento) => {
    const archivo = evento.target.files[0];
    if (archivo) importarDatos(archivo);
    inputImportarArchivo.value = ""; // permite volver a elegir el mismo archivo después
  });

  // --- Cargar datos de ejemplo (demo) ---
  document.getElementById("boton-cargar-demo").addEventListener("click", async () => {
    const confirmar = await mostrarConfirmacion(
      "Esto va a reemplazar los datos actuales por los de ejemplo (demo). ¿Continuar?"
    );
    if (!confirmar) return;

    cargarDatosDeEjemplo();
    renderizarInicio();
    renderizarAjustes();
    mostrarAlerta("Datos de ejemplo cargados.");
  });
});

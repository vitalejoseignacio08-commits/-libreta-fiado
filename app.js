/* ===========================================
   app.js - Lógica de la Libreta de Fiado
   Por ahora: Pantalla de Inicio + datos de ejemplo
   =========================================== */

const CLAVE_STORAGE = "libreta-fiado-datos";

// Guardan en qué cliente y qué tipo de movimiento estamos trabajando
// mientras navegamos entre pantallas
let clienteActualId = null;
let tipoMovimientoActual = null; // "fiado" o "pago"

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
   (siempre envuelto en try/catch, como pide
   el proyecto, por si el celular no permite
   guardar o el dato está corrupto)
   ------------------------------------------- */
function leerDatos() {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    if (!guardado) {
      const ejemplo = datosDeEjemplo();
      guardarDatos(ejemplo);
      return ejemplo;
    }
    return JSON.parse(guardado);
  } catch (error) {
    console.error("Error al leer los datos guardados:", error);
    return datosDeEjemplo();
  }
}

function guardarDatos(datos) {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(datos));
  } catch (error) {
    console.error("Error al guardar los datos:", error);
  }
}

/* -------------------------------------------
   Cálculos sobre un cliente
   ------------------------------------------- */

// Saldo = total fiado - total pagado
function calcularSaldo(cliente) {
  return cliente.movimientos.reduce((saldo, mov) => {
    return mov.tipo === "fiado" ? saldo + mov.monto : saldo - mov.monto;
  }, 0);
}

// Fecha del último pago (o null si nunca pagó)
function fechaUltimoPago(cliente) {
  const pagos = cliente.movimientos.filter((m) => m.tipo === "pago");
  if (pagos.length === 0) return null;
  const fechas = pagos.map((p) => new Date(p.fecha));
  return new Date(Math.max(...fechas));
}

// ¿Hace más de 30 días que no paga?
function estaAtrasado(cliente) {
  const ultimoPago = fechaUltimoPago(cliente);
  // Si nunca pagó, usamos la fecha del primer fiado como referencia
  const fechaReferencia = ultimoPago || new Date(cliente.movimientos[0]?.fecha);
  if (!fechaReferencia || isNaN(fechaReferencia)) return false;

  const hoy = new Date();
  const diasSinPagar = (hoy - fechaReferencia) / (1000 * 60 * 60 * 24);
  return diasSinPagar > 30;
}

/* -------------------------------------------
   Formato de moneda argentino: $ 12.345
   ------------------------------------------- */
function formatearMonto(numero) {
  const redondeado = Math.round(numero);
  const conPuntos = redondeado.toLocaleString("es-AR");
  return `$ ${conPuntos}`;
}

/* -------------------------------------------
   Formato de fecha: dd/mm/aaaa
   (las fechas se guardan como "aaaa-mm-dd",
   que es el formato que usa <input type="date">)
   ------------------------------------------- */
function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

// Fecha de hoy en formato "aaaa-mm-dd" para precargar el input de fecha
function fechaDeHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

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
    alert("Este cliente no tiene un teléfono guardado.");
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
function exportarDatos() {
  const datos = leerDatos();
  const contenido = JSON.stringify(datos, null, 2);
  const archivo = new Blob([contenido], { type: "application/json" });

  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `libreta-fiado-backup-${fechaDeHoyISO()}.json`;
  enlace.click();

  URL.revokeObjectURL(enlace.href);
}

function importarDatos(archivo) {
  const lector = new FileReader();

  lector.onload = () => {
    try {
      const datosImportados = JSON.parse(lector.result);

      // Chequeo mínimo de que el archivo tenga la forma esperada
      if (!Array.isArray(datosImportados.clientes) || !datosImportados.negocio) {
        alert("El archivo no tiene el formato correcto de una copia de seguridad.");
        return;
      }

      const confirmar = confirm(
        "Esto va a reemplazar todos los datos actuales por los del archivo. ¿Continuar?"
      );
      if (!confirmar) return;

      guardarDatos(datosImportados);
      renderizarInicio();
      renderizarAjustes();
      alert("Datos importados correctamente.");
    } catch (error) {
      console.error("Error al importar datos:", error);
      alert("No se pudo leer el archivo. ¿Es una copia de seguridad válida?");
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

    clientesFiltrados.forEach((cliente) => {
      const saldo = calcularSaldo(cliente);
      const atrasado = estaAtrasado(cliente);

      const item = document.createElement("li");
      item.className = "item-cliente" + (atrasado ? " atrasado" : "");
      item.innerHTML = `
        <span class="nombre-cliente">${cliente.nombre}</span>
        <span class="saldo-cliente">${formatearMonto(saldo)}</span>
      `;
      item.addEventListener("click", () => {
        clienteActualId = cliente.id;
        renderizarFicha();
        mostrarPantalla("pantalla-ficha-cliente");
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

    movimientosOrdenados.forEach((mov) => {
      const signo = mov.tipo === "fiado" ? "+" : "-";
      const item = document.createElement("li");
      item.className = "item-movimiento " + mov.tipo;
      item.innerHTML = `
        <span class="info-movimiento">
          <span class="detalle-movimiento">${mov.detalle || (mov.tipo === "fiado" ? "Fiado" : "Pago")}</span>
          <span class="fecha-movimiento">${formatearFecha(mov.fecha)}</span>
        </span>
        <span class="monto-movimiento">${signo} ${formatearMonto(mov.monto)}</span>
      `;
      lista.appendChild(item);
    });
  }
}

/* -------------------------------------------
   Navegación simple entre pantallas
   (todas viven en el mismo index.html,
   se muestra una y se ocultan las demás)
   ------------------------------------------- */
function mostrarPantalla(idPantalla) {
  document.querySelectorAll(".pantalla").forEach((pantalla) => {
    pantalla.hidden = pantalla.id !== idPantalla;
  });

  // El botón flotante sólo tiene sentido en la pantalla de Inicio
  const botonNuevoCliente = document.getElementById("boton-nuevo-cliente");
  botonNuevoCliente.hidden = idPantalla !== "pantalla-inicio";
}

/* -------------------------------------------
   Agregar un cliente nuevo
   ------------------------------------------- */
function generarId() {
  // Alcanza con esto para una app que corre en un solo celular
  return Date.now().toString();
}

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

/* -------------------------------------------
   Agregar un movimiento (fiado o pago) a un cliente
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
  renderizarInicio();

  const inputBuscar = document.getElementById("input-buscar");
  inputBuscar.addEventListener("input", (evento) => {
    renderizarInicio(evento.target.value);
  });

  const botonNuevoCliente = document.getElementById("boton-nuevo-cliente");
  botonNuevoCliente.addEventListener("click", () => {
    mostrarPantalla("pantalla-nuevo-cliente");
  });

  const botonCancelar = document.getElementById("boton-cancelar-nuevo-cliente");
  botonCancelar.addEventListener("click", () => {
    document.getElementById("form-nuevo-cliente").reset();
    document.getElementById("error-nuevo-cliente").hidden = true;
    mostrarPantalla("pantalla-inicio");
  });

  const formNuevoCliente = document.getElementById("form-nuevo-cliente");
  formNuevoCliente.addEventListener("submit", (evento) => {
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

    agregarCliente(nombre, telefono, nota);

    formNuevoCliente.reset();
    errorElemento.hidden = true;
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

  // --- Abrir la pantalla de Cargar Movimiento (Fiado o Pago) ---
  function abrirCargarMovimiento(tipo) {
    tipoMovimientoActual = tipo;

    document.getElementById("titulo-cargar-movimiento").textContent =
      tipo === "fiado" ? "Nuevo fiado" : "Nuevo pago";
    document.getElementById("input-monto").value = "";
    document.getElementById("input-detalle").value = "";
    document.getElementById("input-fecha").value = fechaDeHoyISO();
    document.getElementById("error-cargar-movimiento").hidden = true;

    mostrarPantalla("pantalla-cargar-movimiento");
    document.getElementById("input-monto").focus();
  }

  document.getElementById("boton-nuevo-fiado").addEventListener("click", () => {
    abrirCargarMovimiento("fiado");
  });

  document.getElementById("boton-nuevo-pago").addEventListener("click", () => {
    abrirCargarMovimiento("pago");
  });

  // --- Cancelar carga de movimiento: volver a la Ficha ---
  document.getElementById("boton-cancelar-movimiento").addEventListener("click", () => {
    renderizarFicha();
    mostrarPantalla("pantalla-ficha-cliente");
  });

  // --- Guardar el movimiento (fiado o pago) ---
  const formCargarMovimiento = document.getElementById("form-cargar-movimiento");
  formCargarMovimiento.addEventListener("submit", (evento) => {
    evento.preventDefault();

    const monto = Number(document.getElementById("input-monto").value);
    const detalle = document.getElementById("input-detalle").value;
    const fecha = document.getElementById("input-fecha").value;
    const errorElemento = document.getElementById("error-cargar-movimiento");

    if (!monto || monto <= 0) {
      errorElemento.textContent = "Ingresá un monto válido.";
      errorElemento.hidden = false;
      return;
    }

    if (!fecha) {
      errorElemento.textContent = "Ingresá una fecha.";
      errorElemento.hidden = false;
      return;
    }

    agregarMovimiento(clienteActualId, tipoMovimientoActual, monto, detalle, fecha);

    renderizarFicha();
    mostrarPantalla("pantalla-ficha-cliente");
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
    alert("Datos del negocio guardados.");
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
});

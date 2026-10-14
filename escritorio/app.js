/* ===========================================
   app.js - Panel de escritorio de Cuentas Claras

   Es una herramienta de SOLO LECTURA: muestra en
   una pantalla grande el backup que se exporta
   desde la app del celular. No edita nada, así
   los datos "de verdad" siempre quedan en el
   celular y nunca se desincronizan.
   =========================================== */

const CLAVE_STORAGE = "cuentas-claras-escritorio-datos";
const CLAVE_FECHA_IMPORTACION = "cuentas-claras-escritorio-fecha-importacion";

let clienteSeleccionadoId = null;

/* -------------------------------------------
   Guardar y leer el último backup importado
   (así no hace falta reimportar cada vez que
   se abre el panel)
   ------------------------------------------- */
function leerDatosGuardados() {
  try {
    const guardado = localStorage.getItem(CLAVE_STORAGE);
    return guardado ? JSON.parse(guardado) : null;
  } catch (error) {
    console.error("Error al leer los datos guardados:", error);
    return null;
  }
}

function guardarDatosImportados(datos) {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(datos));
    localStorage.setItem(CLAVE_FECHA_IMPORTACION, new Date().toISOString());
  } catch (error) {
    console.error("Error al guardar los datos importados:", error);
  }
}

function leerFechaImportacion() {
  try {
    return localStorage.getItem(CLAVE_FECHA_IMPORTACION);
  } catch (error) {
    return null;
  }
}

/* -------------------------------------------
   Misma validación que usa la app del celular
   antes de importar: si el archivo no tiene
   exactamente esta forma, no lo aceptamos.
   ------------------------------------------- */
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

function mostrarErrorImportar(mensaje) {
  const elemento = document.getElementById("mensaje-error-importar");
  elemento.textContent = mensaje;
  elemento.hidden = false;
  setTimeout(() => {
    elemento.hidden = true;
  }, 5000);
}

function importarArchivo(archivo) {
  const lector = new FileReader();

  lector.onload = () => {
    try {
      const datos = JSON.parse(lector.result);

      if (!estructuraDeDatosEsValida(datos)) {
        mostrarErrorImportar(
          "Ese archivo no tiene el formato de una copia de seguridad de Cuentas Claras."
        );
        return;
      }

      guardarDatosImportados(datos);
      clienteSeleccionadoId = null;
      renderizarTodo();
    } catch (error) {
      console.error("Error al importar el archivo:", error);
      mostrarErrorImportar("No se pudo leer el archivo. ¿Es un backup válido (.json)?");
    }
  };

  lector.readAsText(archivo);
}

/* -------------------------------------------
   Cálculos sobre un cliente (igual que en el celular)
   ------------------------------------------- */
function calcularSaldo(cliente) {
  return cliente.movimientos.reduce((saldo, mov) => {
    return mov.tipo === "fiado" ? saldo + mov.monto : saldo - mov.monto;
  }, 0);
}

function fechaUltimoPago(cliente) {
  const pagos = cliente.movimientos.filter((m) => m.tipo === "pago");
  if (pagos.length === 0) return null;
  const fechas = pagos.map((p) => new Date(p.fecha));
  return new Date(Math.max(...fechas));
}

function estaAtrasado(cliente) {
  const ultimoPago = fechaUltimoPago(cliente);
  const fechaReferencia = ultimoPago || new Date(cliente.movimientos[0]?.fecha);
  if (!fechaReferencia || isNaN(fechaReferencia)) return false;

  const hoy = new Date();
  const diasSinPagar = (hoy - fechaReferencia) / (1000 * 60 * 60 * 24);
  return diasSinPagar > 15;
}

function formatearMonto(numero) {
  const redondeado = Math.round(numero);
  return `$ ${redondeado.toLocaleString("es-AR")}`;
}

function formatearFecha(fechaISO) {
  const [anio, mes, dia] = fechaISO.split("-");
  return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fechaISOCompleta) {
  const fecha = new Date(fechaISOCompleta);
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  const hora = String(fecha.getHours()).padStart(2, "0");
  const minutos = String(fecha.getMinutes()).padStart(2, "0");
  return `${dia}/${mes}/${anio} ${hora}:${minutos}`;
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/* -------------------------------------------
   Render
   ------------------------------------------- */
function renderizarTodo() {
  const datos = leerDatosGuardados();
  const pantallaVacia = document.getElementById("pantalla-vacia");
  const contenido = document.getElementById("contenido");

  if (!datos) {
    pantallaVacia.hidden = false;
    contenido.hidden = true;
    return;
  }

  pantallaVacia.hidden = true;
  contenido.hidden = false;

  document.getElementById("nombre-negocio").textContent =
    datos.negocio?.nombre || "Panel de escritorio";

  const fechaImportacion = leerFechaImportacion();
  const elementoFecha = document.getElementById("fecha-importacion");
  if (fechaImportacion) {
    elementoFecha.textContent = `Datos importados: ${formatearFechaHora(fechaImportacion)}`;
    elementoFecha.hidden = false;
  } else {
    elementoFecha.hidden = true;
  }

  renderizarLista(document.getElementById("input-buscar").value);
  renderizarFicha();
}

function renderizarLista(filtro = "") {
  const datos = leerDatosGuardados();
  if (!datos) return;

  const lista = document.getElementById("lista-clientes");
  const avisoSinClientes = document.getElementById("aviso-sin-clientes");

  const totalEnCalle = datos.clientes.reduce((total, c) => total + calcularSaldo(c), 0);
  document.getElementById("monto-total").textContent = formatearMonto(totalEnCalle);

  const filtroNormalizado = filtro.trim().toLowerCase();
  const clientesFiltrados = datos.clientes.filter((c) =>
    c.nombre.toLowerCase().includes(filtroNormalizado)
  );
  clientesFiltrados.sort((a, b) => calcularSaldo(b) - calcularSaldo(a));

  lista.innerHTML = "";

  if (clientesFiltrados.length === 0) {
    avisoSinClientes.hidden = false;
    return;
  }
  avisoSinClientes.hidden = true;

  clientesFiltrados.forEach((cliente) => {
    const saldo = calcularSaldo(cliente);
    const atrasado = estaAtrasado(cliente);

    const item = document.createElement("li");
    item.className =
      "item-cliente" +
      (atrasado ? " atrasado" : "") +
      (cliente.id === clienteSeleccionadoId ? " seleccionado" : "");
    item.innerHTML = `
      <span class="nombre-cliente">${escaparHtml(cliente.nombre)}</span>
      <span class="saldo-cliente">${formatearMonto(saldo)}</span>
    `;
    item.addEventListener("click", () => {
      clienteSeleccionadoId = cliente.id;
      renderizarLista(filtro);
      renderizarFicha();
    });
    lista.appendChild(item);
  });
}

function renderizarFicha() {
  const datos = leerDatosGuardados();
  const fichaVacia = document.getElementById("ficha-vacia");
  const fichaCliente = document.getElementById("ficha-cliente");

  const cliente = datos?.clientes.find((c) => c.id === clienteSeleccionadoId);
  if (!datos || !cliente) {
    fichaVacia.hidden = false;
    fichaCliente.hidden = true;
    return;
  }

  fichaVacia.hidden = true;
  fichaCliente.hidden = false;

  document.getElementById("ficha-nombre").textContent = cliente.nombre;
  document.getElementById("ficha-telefono").textContent = cliente.telefono
    ? `Tel: ${cliente.telefono}`
    : "";
  document.getElementById("ficha-nota").textContent = cliente.nota || "";
  document.getElementById("ficha-saldo").textContent = formatearMonto(calcularSaldo(cliente));

  const lista = document.getElementById("lista-movimientos");
  const avisoVacio = document.getElementById("aviso-sin-movimientos");
  lista.innerHTML = "";

  if (cliente.movimientos.length === 0) {
    avisoVacio.hidden = false;
    return;
  }
  avisoVacio.hidden = true;

  const movimientosOrdenados = [...cliente.movimientos].sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );

  movimientosOrdenados.forEach((mov) => {
    const signo = mov.tipo === "fiado" ? "+" : "-";
    const detalle = mov.detalle || (mov.tipo === "fiado" ? "Fiado" : "Pago");

    const item = document.createElement("li");
    item.className = "item-movimiento " + mov.tipo;
    item.innerHTML = `
      <span class="info-movimiento">
        <span class="detalle-movimiento">${escaparHtml(detalle)}</span>
        <span class="fecha-movimiento">${formatearFecha(mov.fecha)}</span>
      </span>
      <span class="monto-movimiento">${signo} ${formatearMonto(mov.monto)}</span>
    `;
    lista.appendChild(item);
  });
}

/* -------------------------------------------
   Conexión con la interfaz
   ------------------------------------------- */
document.addEventListener("DOMContentLoaded", () => {
  renderizarTodo();

  const inputImportar = document.getElementById("input-importar-archivo");

  document.getElementById("boton-importar").addEventListener("click", () => {
    inputImportar.click();
  });
  document.getElementById("boton-importar-vacio").addEventListener("click", () => {
    inputImportar.click();
  });

  inputImportar.addEventListener("change", (evento) => {
    const archivo = evento.target.files[0];
    if (archivo) importarArchivo(archivo);
    inputImportar.value = "";
  });

  document.getElementById("input-buscar").addEventListener("input", (evento) => {
    renderizarLista(evento.target.value);
  });
});

/* ===========================================
   app.js - Panel de escritorio de Cuentas Claras

   Es una app INDEPENDIENTE de la del celular: tiene
   sus propios datos guardados en esta compu, y se
   puede usar sola (alta de clientes, fiados, pagos).
   El backup .json sigue sirviendo para pasar datos
   de una app a la otra a mano, pero no son lo mismo:
   si editás en las dos por separado sin pasarte el
   backup seguido, van a tener historiales distintos.
   =========================================== */

const CLAVE_STORAGE = "cuentas-claras-escritorio-datos";
const CLAVE_FECHA_IMPORTACION = "cuentas-claras-escritorio-fecha-actualizacion";

// Techo para el monto de un fiado/pago, para avisar si alguien
// se equivoca de ceros al escribir (ej. 100 millones de pesos)
const LIMITE_MONTO = 100000000;

let clienteSeleccionadoId = null;
let clienteEditandoId = null; // si no es null, el modal de cliente está editando (no creando)
let movimientoEditandoId = null; // si no es null, el modal de movimiento está editando (no creando)
let tipoMovimientoActual = null; // "fiado" o "pago", para el modal de nuevo movimiento

/* -------------------------------------------
   Datos de ejemplo: para ver el panel funcionando
   sin tener que importar un backup real todavía
   ------------------------------------------- */
function datosDeEjemplo() {
  return {
    negocio: { nombre: "Forrajería San José" },
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
        movimientos: [{ id: "m5", tipo: "fiado", monto: 3000, detalle: "Semillas", fecha: "2026-10-05" }],
      },
    ],
  };
}

function cargarDatosDeEjemplo() {
  guardarDatos(datosDeEjemplo());
  clienteSeleccionadoId = null;
  renderizarTodo();
}

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

// Guarda los datos en esta compu y actualiza la marca de "última
// actualización" (se usa tanto al importar un backup como al
// agregar/editar/borrar algo directo en el panel)
function guardarDatos(datos) {
  try {
    localStorage.setItem(CLAVE_STORAGE, JSON.stringify(datos));
    localStorage.setItem(CLAVE_FECHA_IMPORTACION, new Date().toISOString());
    return true;
  } catch (error) {
    console.error("Error al guardar los datos:", error);
    mostrarErrorImportar("No se pudo guardar el cambio en esta compu. Revisá el espacio disponible o si el navegador está en modo privado.");
    return false;
  }
}

function datosVacios() {
  return { negocio: { nombre: "" }, clientes: [] };
}

// Alcanza con esto para una app que corre en una sola compu
function generarId() {
  return Date.now().toString();
}

// Borra los datos guardados en ESTA compu (el backup original del
// celular no se toca para nada, esto solo afecta la copia local
// del panel de escritorio)
function olvidarDatosImportados() {
  try {
    localStorage.removeItem(CLAVE_STORAGE);
    localStorage.removeItem(CLAVE_FECHA_IMPORTACION);
  } catch (error) {
    console.error("Error al borrar los datos importados:", error);
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

      if (leerDatosGuardados()) {
        const confirmar = window.confirm(
          "Esto reemplaza todos los datos que ya tenés cargados en esta compu por los del archivo. ¿Continuar?"
        );
        if (!confirmar) return;
      }

      guardarDatos(datos);
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
   Exportar a Excel (.csv)
   Un .csv es un archivo de texto simple que Excel
   y Google Sheets abren directo, sin necesitar
   ninguna librería extra.
   ------------------------------------------- */

// Fecha de hoy en formato "aaaa-mm-dd", para el nombre del archivo
function fechaDeHoyISO() {
  const hoy = new Date();
  const anio = hoy.getFullYear();
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  const dia = String(hoy.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

// Envuelve un valor entre comillas si tiene coma, comillas o salto de
// línea, como pide el formato CSV. Si no, lo deja tal cual.
function celdaCsv(valor) {
  const texto = String(valor ?? "");
  if (texto.includes(",") || texto.includes('"') || texto.includes("\n")) {
    return `"${texto.replace(/"/g, '""')}"`;
  }
  return texto;
}

function generarCsvClientes(clientes) {
  const encabezado = ["Cliente", "Teléfono", "Nota", "Saldo", "Último pago"];
  const filas = [encabezado];

  // Mismo orden que la lista en pantalla: mayor deuda primero
  const ordenados = [...clientes].sort((a, b) => calcularSaldo(b) - calcularSaldo(a));

  ordenados.forEach((cliente) => {
    const ultimoPago = fechaUltimoPago(cliente);
    filas.push([
      cliente.nombre,
      cliente.telefono,
      cliente.nota,
      calcularSaldo(cliente),
      ultimoPago ? formatearFechaDesdeDate(ultimoPago) : "Nunca pagó",
    ]);
  });

  // BOM al inicio: sin esto, Excel en Windows puede mostrar mal las tildes
  return "﻿" + filas.map((fila) => fila.map(celdaCsv).join(",")).join("\r\n");
}

function formatearFechaDesdeDate(fecha) {
  const dia = String(fecha.getDate()).padStart(2, "0");
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const anio = fecha.getFullYear();
  return `${dia}/${mes}/${anio}`;
}

// Arma la tabla de impresión con los mismos datos y el mismo orden
// que la lista en pantalla, y recién ahí dispara la impresión.
function imprimirResumen() {
  const datos = leerDatosGuardados();
  if (!datos) return;

  document.getElementById("impresion-nombre-negocio").textContent =
    datos.negocio?.nombre || "Cuentas Claras";
  document.getElementById("impresion-fecha").textContent =
    `Resumen de cuentas - ${formatearFechaDesdeDate(new Date())}`;

  const totalEnCalle = datos.clientes.reduce((total, c) => total + calcularSaldo(c), 0);
  document.getElementById("impresion-total").textContent = formatearMonto(totalEnCalle);

  const ordenados = [...datos.clientes].sort((a, b) => calcularSaldo(b) - calcularSaldo(a));
  const cuerpo = document.getElementById("impresion-cuerpo-tabla");
  cuerpo.innerHTML = "";

  ordenados.forEach((cliente) => {
    const ultimoPago = fechaUltimoPago(cliente);
    const fila = document.createElement("tr");
    fila.innerHTML = `
      <td>${escaparHtml(cliente.nombre)}</td>
      <td>${escaparHtml(cliente.telefono)}</td>
      <td>${ultimoPago ? formatearFechaDesdeDate(ultimoPago) : "Nunca pagó"}</td>
      <td class="monto-impresion">${formatearMonto(calcularSaldo(cliente))}</td>
    `;
    cuerpo.appendChild(fila);
  });

  window.print();
}

function exportarCsv() {
  const datos = leerDatosGuardados();
  if (!datos) return;

  const contenido = generarCsvClientes(datos.clientes);
  const archivo = new Blob([contenido], { type: "text/csv;charset=utf-8" });

  const enlace = document.createElement("a");
  enlace.href = URL.createObjectURL(archivo);
  enlace.download = `cuentas-claras-clientes-${fechaDeHoyISO()}.csv`;
  enlace.click();

  URL.revokeObjectURL(enlace.href);
}

/* -------------------------------------------
   Gráficos (dibujados a mano con <canvas>, sin
   ninguna librería externa: así el panel sigue
   sin depender de internet para funcionar)
   ------------------------------------------- */

// Limpia el canvas y lo prepara con el tamaño real que ocupa en
// pantalla (si no, se ve borroso en pantallas de alta densidad)
function prepararCanvas(canvas) {
  const contexto = canvas.getContext("2d");
  const escala = window.devicePixelRatio || 1;
  const anchoCss = canvas.clientWidth || canvas.width;
  const altoCss = canvas.height / canvas.width * anchoCss;

  canvas.style.height = `${altoCss}px`;
  canvas.width = anchoCss * escala;
  canvas.height = altoCss * escala;
  contexto.setTransform(escala, 0, 0, escala, 0, 0);

  contexto.clearRect(0, 0, anchoCss, altoCss);
  return { contexto, ancho: anchoCss, alto: altoCss };
}

// Gráfico de barras horizontales: los 8 clientes con más deuda
function dibujarGraficoRanking(datos) {
  const canvas = document.getElementById("grafico-ranking");
  const aviso = document.getElementById("aviso-sin-datos-ranking");
  if (!datos) return;

  const deudores = datos.clientes
    .map((c) => ({ nombre: c.nombre, saldo: calcularSaldo(c) }))
    .filter((c) => c.saldo > 0)
    .sort((a, b) => b.saldo - a.saldo)
    .slice(0, 8);

  if (deudores.length === 0) {
    aviso.hidden = false;
    canvas.hidden = true;
    return;
  }
  aviso.hidden = true;
  canvas.hidden = false;

  const { contexto, ancho, alto } = prepararCanvas(canvas);
  const margenIzquierdo = 160;
  const margenDerecho = 90;
  const altoBarra = 26;
  const espacioEntreBarras = (alto - 20) / deudores.length;
  const maximo = Math.max(...deudores.map((d) => d.saldo));

  contexto.font = "13px -apple-system, Segoe UI, Arial, sans-serif";
  contexto.textBaseline = "middle";

  deudores.forEach((cliente, indice) => {
    const y = 10 + indice * espacioEntreBarras + espacioEntreBarras / 2;
    const anchoDisponible = ancho - margenIzquierdo - margenDerecho;
    const anchoBarra = maximo > 0 ? (cliente.saldo / maximo) * anchoDisponible : 0;

    // Nombre del cliente, a la izquierda
    contexto.fillStyle = "#1a1f1c";
    contexto.textAlign = "right";
    contexto.fillText(cliente.nombre, margenIzquierdo - 12, y, margenIzquierdo - 20);

    // Barra
    contexto.fillStyle = "#d62828";
    contexto.fillRect(margenIzquierdo, y - altoBarra / 2, anchoBarra, altoBarra);

    // Monto, a la derecha de la barra
    contexto.fillStyle = "#1a1f1c";
    contexto.textAlign = "left";
    contexto.fillText(formatearMonto(cliente.saldo), margenIzquierdo + anchoBarra + 10, y);
  });
}

// Agrupa los movimientos de todos los clientes por mes, para los
// últimos 6 meses (incluyendo el actual)
function totalesPorMes(clientes) {
  const hoy = new Date();
  const meses = [];

  for (let i = 5; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    meses.push({
      clave: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}`,
      etiqueta: fecha.toLocaleDateString("es-AR", { month: "short" }).replace(".", ""),
      fiado: 0,
      pago: 0,
    });
  }

  clientes.forEach((cliente) => {
    cliente.movimientos.forEach((mov) => {
      const [anio, mes] = mov.fecha.split("-");
      const clave = `${anio}-${mes}`;
      const mesEncontrado = meses.find((m) => m.clave === clave);
      if (mesEncontrado) {
        mesEncontrado[mov.tipo] += mov.monto;
      }
    });
  });

  return meses;
}

// Gráfico de barras agrupadas: fiado vs. pagos, mes a mes
function dibujarGraficoMensual(datos) {
  const canvas = document.getElementById("grafico-mensual");
  const aviso = document.getElementById("aviso-sin-datos-mensual");
  if (!datos) return;

  const meses = totalesPorMes(datos.clientes);
  const hayMovimientos = meses.some((m) => m.fiado > 0 || m.pago > 0);

  if (!hayMovimientos) {
    aviso.hidden = false;
    canvas.hidden = true;
    return;
  }
  aviso.hidden = true;
  canvas.hidden = false;

  const { contexto, ancho, alto } = prepararCanvas(canvas);
  const margenInferior = 30;
  const margenSuperior = 10;
  const altoDisponible = alto - margenInferior - margenSuperior;
  const maximo = Math.max(...meses.map((m) => Math.max(m.fiado, m.pago)), 1);

  const anchoGrupo = ancho / meses.length;
  const anchoBarra = anchoGrupo * 0.3;

  contexto.font = "12px -apple-system, Segoe UI, Arial, sans-serif";
  contexto.textAlign = "center";

  meses.forEach((mes, indice) => {
    const centroGrupo = indice * anchoGrupo + anchoGrupo / 2;

    const altoFiado = (mes.fiado / maximo) * altoDisponible;
    const altoPago = (mes.pago / maximo) * altoDisponible;

    contexto.fillStyle = "#d62828";
    contexto.fillRect(
      centroGrupo - anchoBarra - 2,
      alto - margenInferior - altoFiado,
      anchoBarra,
      altoFiado
    );

    contexto.fillStyle = "#2d6a4f";
    contexto.fillRect(centroGrupo + 2, alto - margenInferior - altoPago, anchoBarra, altoPago);

    // Nombre del mes, abajo
    contexto.fillStyle = "#6b7280";
    contexto.fillText(mes.etiqueta, centroGrupo, alto - 10);
  });
}

function mostrarPantallaGraficos() {
  const datos = leerDatosGuardados();
  document.getElementById("contenido").hidden = true;
  document.getElementById("pantalla-graficos").hidden = false;
  dibujarGraficoRanking(datos);
  dibujarGraficoMensual(datos);
}

function ocultarPantallaGraficos() {
  document.getElementById("pantalla-graficos").hidden = true;
  document.getElementById("contenido").hidden = false;
}

/* -------------------------------------------
   Cálculos sobre un cliente (igual que en el celular)
   ------------------------------------------- */
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

function fechaUltimoPago(cliente) {
  const pagos = cliente.movimientos.filter((m) => m.tipo === "pago");
  if (pagos.length === 0) return null;
  const fechas = pagos.map((p) => fechaISOaDate(p.fecha));
  return new Date(Math.max(...fechas));
}

function estaAtrasado(cliente) {
  const ultimoPago = fechaUltimoPago(cliente);
  const primerFiado = cliente.movimientos[0]?.fecha;
  const fechaReferencia = ultimoPago || (primerFiado && fechaISOaDate(primerFiado));
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

// Teléfono argentino: código de área + número, sin el 0 ni el 15,
// 10 números en total. El campo es opcional, vacío también es válido.
function telefonoEsValido(telefono) {
  const limpio = telefono.replace(/\D/g, "");
  if (limpio === "") return true;
  return limpio.length === 10;
}

// Para avisar antes de crear sin querer un cliente con el mismo
// nombre que otro ya cargado
function existeClienteConNombre(datos, nombre, excluirId) {
  const nombreNormalizado = nombre.trim().toLowerCase();
  return datos.clientes.some(
    (c) => c.id !== excluirId && c.nombre.trim().toLowerCase() === nombreNormalizado
  );
}

function escaparHtml(texto) {
  const div = document.createElement("div");
  div.textContent = texto;
  return div.innerHTML;
}

/* -------------------------------------------
   Alta, edición y borrado de clientes y
   movimientos (fiado o pago)
   ------------------------------------------- */
function agregarCliente(nombre, telefono, nota) {
  const datos = leerDatosGuardados() || datosVacios();
  datos.clientes.push({
    id: generarId(),
    nombre: nombre.trim(),
    telefono: telefono.trim(),
    nota: nota.trim(),
    movimientos: [],
  });
  guardarDatos(datos);
  return datos;
}

function editarCliente(id, nombre, telefono, nota) {
  const datos = leerDatosGuardados();
  const cliente = datos?.clientes.find((c) => c.id === id);
  if (!cliente) return datos;

  cliente.nombre = nombre.trim();
  cliente.telefono = telefono.trim();
  cliente.nota = nota.trim();
  guardarDatos(datos);
  return datos;
}

function eliminarCliente(id) {
  const datos = leerDatosGuardados();
  if (!datos) return datos;
  datos.clientes = datos.clientes.filter((c) => c.id !== id);
  guardarDatos(datos);
  return datos;
}

function agregarMovimiento(clienteId, tipo, monto, detalle, fecha) {
  const datos = leerDatosGuardados();
  const cliente = datos?.clientes.find((c) => c.id === clienteId);
  if (!cliente) return datos;

  cliente.movimientos.push({ id: generarId(), tipo, monto, detalle: detalle.trim(), fecha });
  guardarDatos(datos);
  return datos;
}

function editarMovimiento(clienteId, movimientoId, monto, detalle, fecha) {
  const datos = leerDatosGuardados();
  const cliente = datos?.clientes.find((c) => c.id === clienteId);
  const movimiento = cliente?.movimientos.find((m) => m.id === movimientoId);
  if (!movimiento) return datos;

  movimiento.monto = monto;
  movimiento.detalle = detalle.trim();
  movimiento.fecha = fecha;
  guardarDatos(datos);
  return datos;
}

function eliminarMovimiento(clienteId, movimientoId) {
  const datos = leerDatosGuardados();
  const cliente = datos?.clientes.find((c) => c.id === clienteId);
  if (!cliente) return datos;

  cliente.movimientos = cliente.movimientos.filter((m) => m.id !== movimientoId);
  guardarDatos(datos);
  return datos;
}

function guardarNombreNegocio(nombre) {
  const datos = leerDatosGuardados() || datosVacios();
  datos.negocio.nombre = nombre.trim();
  guardarDatos(datos);
  return datos;
}

/* -------------------------------------------
   Render
   ------------------------------------------- */
function renderizarTodo() {
  const datos = leerDatosGuardados();
  const pantallaVacia = document.getElementById("pantalla-vacia");
  const contenido = document.getElementById("contenido");

  // Importar, olvidar datos o cargar la demo siempre vuelven a la
  // lista principal, aunque se hayan disparado desde la pantalla de
  // gráficos (sus botones viven en el header, visible en todas lados)
  document.getElementById("pantalla-graficos").hidden = true;

  if (!datos) {
    pantallaVacia.hidden = false;
    contenido.hidden = true;
    document.getElementById("boton-exportar-csv").hidden = true;
    document.getElementById("boton-imprimir").hidden = true;
    document.getElementById("boton-ver-graficos").hidden = true;
    document.getElementById("boton-olvidar-datos").hidden = true;
    document.getElementById("boton-ajustes-negocio").hidden = true;
    return;
  }

  pantallaVacia.hidden = true;
  contenido.hidden = false;
  document.getElementById("boton-exportar-csv").hidden = false;
  document.getElementById("boton-imprimir").hidden = false;
  document.getElementById("boton-ver-graficos").hidden = false;
  document.getElementById("boton-olvidar-datos").hidden = false;
  document.getElementById("boton-ajustes-negocio").hidden = false;

  document.getElementById("nombre-negocio").textContent =
    datos.negocio?.nombre || "Panel de escritorio";

  const fechaImportacion = leerFechaImportacion();
  const elementoFecha = document.getElementById("fecha-importacion");
  if (fechaImportacion) {
    elementoFecha.textContent = `Última actualización: ${formatearFechaHora(fechaImportacion)}`;
    elementoFecha.hidden = false;
  } else {
    elementoFecha.hidden = true;
  }

  renderizarResumen(datos);
  renderizarLista(document.getElementById("input-buscar").value);
  renderizarFicha();
}

// Tarjetas de resumen: siempre sobre TODOS los clientes, sin
// importar el filtro de búsqueda que esté usando el dueño
function renderizarResumen(datos) {
  const conDeuda = datos.clientes.filter((c) => calcularSaldo(c) > 0);
  const atrasados = datos.clientes.filter((c) => estaAtrasado(c));

  document.getElementById("resumen-total-clientes").textContent = datos.clientes.length;
  document.getElementById("resumen-con-deuda").textContent = conDeuda.length;
  document.getElementById("resumen-atrasados").textContent = atrasados.length;
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
    item.addEventListener("click", () => {
      abrirModalMovimiento(mov.tipo, mov);
    });
    lista.appendChild(item);
  });
}

/* -------------------------------------------
   Modal: nuevo cliente / editar cliente
   ------------------------------------------- */
function abrirModalCliente(cliente) {
  clienteEditandoId = cliente ? cliente.id : null;

  document.getElementById("titulo-modal-cliente").textContent = cliente
    ? "Editar cliente"
    : "Nuevo cliente";
  document.getElementById("input-cliente-nombre").value = cliente?.nombre || "";
  document.getElementById("input-cliente-telefono").value = cliente?.telefono || "";
  document.getElementById("input-cliente-nota").value = cliente?.nota || "";
  document.getElementById("error-cliente").hidden = true;
  document.getElementById("boton-eliminar-cliente-modal").hidden = !cliente;

  document.getElementById("overlay-modal-cliente").hidden = false;
  document.getElementById("input-cliente-nombre").focus();
}

function cerrarModalCliente() {
  document.getElementById("overlay-modal-cliente").hidden = true;
  clienteEditandoId = null;
}

/* -------------------------------------------
   Modal: nuevo movimiento / editar movimiento
   ------------------------------------------- */
function abrirModalMovimiento(tipo, movimiento) {
  tipoMovimientoActual = tipo;
  movimientoEditandoId = movimiento ? movimiento.id : null;

  document.getElementById("titulo-modal-movimiento").textContent = movimiento
    ? (tipo === "fiado" ? "Editar fiado" : "Editar pago")
    : (tipo === "fiado" ? "Nuevo fiado" : "Nuevo pago");
  document.getElementById("input-movimiento-monto").value = movimiento?.monto || "";
  document.getElementById("input-movimiento-detalle").value = movimiento?.detalle || "";
  document.getElementById("input-movimiento-fecha").value = movimiento?.fecha || fechaDeHoyISO();
  document.getElementById("error-movimiento").hidden = true;
  document.getElementById("boton-eliminar-movimiento-modal").hidden = !movimiento;

  document.getElementById("overlay-modal-movimiento").hidden = false;
  document.getElementById("input-movimiento-monto").focus();
}

function cerrarModalMovimiento() {
  document.getElementById("overlay-modal-movimiento").hidden = true;
  movimientoEditandoId = null;
}

/* -------------------------------------------
   Modal: ajustes (nombre del negocio)
   ------------------------------------------- */
function abrirModalAjustes() {
  const datos = leerDatosGuardados() || datosVacios();
  document.getElementById("input-nombre-negocio").value = datos.negocio?.nombre || "";
  document.getElementById("overlay-modal-ajustes").hidden = false;
  document.getElementById("input-nombre-negocio").focus();
}

function cerrarModalAjustes() {
  document.getElementById("overlay-modal-ajustes").hidden = true;
}

/* -------------------------------------------
   Conexión con la interfaz
   ------------------------------------------- */

// Registra el service worker para que el panel siga abriendo sin
// internet una vez que se usó al menos una vez en esta compu
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("service-worker.js").catch((error) => {
      console.error("No se pudo registrar el service worker:", error);
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderizarTodo();

  const inputImportar = document.getElementById("input-importar-archivo");

  document.getElementById("boton-importar").addEventListener("click", () => {
    inputImportar.click();
  });
  document.getElementById("boton-importar-vacio").addEventListener("click", () => {
    inputImportar.click();
  });
  document.getElementById("boton-demo-vacio").addEventListener("click", () => {
    cargarDatosDeEjemplo();
  });
  document.getElementById("boton-empezar-vacio").addEventListener("click", () => {
    guardarDatos(datosVacios());
    clienteSeleccionadoId = null;
    renderizarTodo();
    abrirModalAjustes();
  });

  document.getElementById("boton-olvidar-datos").addEventListener("click", () => {
    const confirmar = window.confirm(
      "Esto borra los datos de esta compu (no afecta el backup del celular). ¿Continuar?"
    );
    if (!confirmar) return;

    olvidarDatosImportados();
    clienteSeleccionadoId = null;
    renderizarTodo();
  });

  inputImportar.addEventListener("change", (evento) => {
    const archivo = evento.target.files[0];
    if (archivo) importarArchivo(archivo);
    inputImportar.value = "";
  });

  document.getElementById("input-buscar").addEventListener("input", (evento) => {
    renderizarLista(evento.target.value);
  });

  document.getElementById("boton-exportar-csv").addEventListener("click", () => {
    exportarCsv();
  });

  document.getElementById("boton-imprimir").addEventListener("click", () => {
    imprimirResumen();
  });

  document.getElementById("boton-ver-graficos").addEventListener("click", () => {
    mostrarPantallaGraficos();
  });

  document.getElementById("boton-volver-graficos").addEventListener("click", () => {
    ocultarPantallaGraficos();
  });

  // Si la ventana cambia de tamaño mientras se ven los gráficos, los
  // volvemos a dibujar para que no queden recortados ni estirados
  window.addEventListener("resize", () => {
    if (!document.getElementById("pantalla-graficos").hidden) {
      const datos = leerDatosGuardados();
      dibujarGraficoRanking(datos);
      dibujarGraficoMensual(datos);
    }
  });

  /* ---------- Nuevo / editar cliente ---------- */
  document.getElementById("boton-nuevo-cliente").addEventListener("click", () => {
    abrirModalCliente(null);
  });

  document.getElementById("boton-editar-cliente").addEventListener("click", () => {
    const datos = leerDatosGuardados();
    const cliente = datos?.clientes.find((c) => c.id === clienteSeleccionadoId);
    if (cliente) abrirModalCliente(cliente);
  });

  document.getElementById("boton-cancelar-cliente").addEventListener("click", () => {
    cerrarModalCliente();
  });

  document.getElementById("form-cliente").addEventListener("submit", (evento) => {
    evento.preventDefault();

    const nombre = document.getElementById("input-cliente-nombre").value;
    const telefono = document.getElementById("input-cliente-telefono").value;
    const nota = document.getElementById("input-cliente-nota").value;
    const errorElemento = document.getElementById("error-cliente");

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

    const datos = leerDatosGuardados() || datosVacios();
    if (existeClienteConNombre(datos, nombre, clienteEditandoId)) {
      const confirmar = window.confirm(`Ya existe un cliente llamado "${nombre.trim()}". ¿Guardarlo igual?`);
      if (!confirmar) return;
    }

    if (clienteEditandoId) {
      editarCliente(clienteEditandoId, nombre, telefono, nota);
      clienteSeleccionadoId = clienteEditandoId;
    } else {
      const datosActualizados = agregarCliente(nombre, telefono, nota);
      clienteSeleccionadoId = datosActualizados.clientes[datosActualizados.clientes.length - 1].id;
    }

    cerrarModalCliente();
    renderizarTodo();
  });

  document.getElementById("boton-eliminar-cliente-modal").addEventListener("click", () => {
    const confirmar = window.confirm(
      "¿Seguro que querés eliminar este cliente? Se borra todo su historial y no se puede deshacer."
    );
    if (!confirmar) return;

    eliminarCliente(clienteEditandoId);
    clienteSeleccionadoId = null;
    cerrarModalCliente();
    renderizarTodo();
  });

  /* ---------- Nuevo / editar movimiento (fiado o pago) ---------- */
  document.getElementById("boton-nuevo-fiado").addEventListener("click", () => {
    abrirModalMovimiento("fiado", null);
  });

  document.getElementById("boton-nuevo-pago").addEventListener("click", () => {
    abrirModalMovimiento("pago", null);
  });

  document.getElementById("boton-cancelar-movimiento").addEventListener("click", () => {
    cerrarModalMovimiento();
  });

  document.getElementById("form-movimiento").addEventListener("submit", (evento) => {
    evento.preventDefault();

    const monto = Math.round(Number(document.getElementById("input-movimiento-monto").value));
    const detalle = document.getElementById("input-movimiento-detalle").value;
    const fecha = document.getElementById("input-movimiento-fecha").value;
    const errorElemento = document.getElementById("error-movimiento");

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
      editarMovimiento(clienteSeleccionadoId, movimientoEditandoId, monto, detalle, fecha);
    } else {
      agregarMovimiento(clienteSeleccionadoId, tipoMovimientoActual, monto, detalle, fecha);
    }

    cerrarModalMovimiento();
    renderizarTodo();
  });

  document.getElementById("boton-eliminar-movimiento-modal").addEventListener("click", () => {
    const confirmar = window.confirm("¿Seguro que querés eliminar este movimiento?");
    if (!confirmar) return;

    eliminarMovimiento(clienteSeleccionadoId, movimientoEditandoId);
    cerrarModalMovimiento();
    renderizarTodo();
  });

  /* ---------- Ajustes (nombre del negocio) ---------- */
  document.getElementById("boton-ajustes-negocio").addEventListener("click", () => {
    abrirModalAjustes();
  });

  document.getElementById("boton-cancelar-ajustes").addEventListener("click", () => {
    cerrarModalAjustes();
  });

  document.getElementById("form-ajustes-negocio").addEventListener("submit", (evento) => {
    evento.preventDefault();
    const nombre = document.getElementById("input-nombre-negocio").value;
    guardarNombreNegocio(nombre);
    cerrarModalAjustes();
    renderizarTodo();
  });
});

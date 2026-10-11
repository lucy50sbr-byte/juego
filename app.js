"use strict";

const $ = (selector) => document.querySelector(selector);
const ui = {
  file: $("#stlFile"),
  laminatorTab: $("#laminatorTab"),
  printerTab: $("#printerTab"),
  laminatorView: $("#laminatorView"),
  printerView: $("#printerView"),
  savedPrinterForm: $("#savedPrinterForm"),
  savedPrinterName: $("#savedPrinterName"),
  toggleSavedPrinters: $("#toggleSavedPrinters"),
  savedPrintersContent: $("#savedPrintersContent"),
  cancelSavedPrinterEdit: $("#cancelSavedPrinterEdit"),
  savedPrintersList: $("#savedPrintersList"),
  printerAddress: $("#printerAddress"),
  printerConnectionStatus: $("#printerConnectionStatus"),
  printerFrame: $("#printerFrame"),
  printerFrameEmpty: $("#printerFrameEmpty"),
  externalPrinterLink: $("#externalPrinterLink"),
  dropZone: $("#dropZone"),
  uploadTitle: $("#uploadTitle"),
  uploadHint: $("#uploadHint"),
  remove: $("#removeModel"),
  modelInfo: $("#modelInfo"),
  modelName: $("#modelName"),
  modelSize: $("#modelSize"),
  modelScale: $("#modelScale"),
  scalePercent: $("#scalePercent"),
  rotationX: $("#rotationX"),
  rotationY: $("#rotationY"),
  rotationZ: $("#rotationZ"),
  positionX: $("#positionX"),
  positionY: $("#positionY"),
  positionZ: $("#positionZ"),
  centerModel: $("#centerModel"),
  fitModel: $("#fitModel"),
  notice: $("#modelNotice"),
  dimensions: [$("#dimX"), $("#dimY"), $("#dimZ")],
  objectSelect: $("#objectSelect"),
  objectColor: $("#objectColor"),
  duplicateObject: $("#duplicateObject"),
  deleteObject: $("#deleteObject"),
  modelCanvas: $("#modelCanvas"),
  modelViewEmpty: $("#modelViewEmpty"),
  viewZoomIn: $("#viewZoomIn"),
  viewZoomOut: $("#viewZoomOut"),
  viewReset: $("#viewReset"),
  moveTool: $("#moveTool"),
  rotateTool: $("#rotateTool"),
  rotationAxes: $("#rotationAxes"),
  transformToolHint: $("#transformToolHint"),
  layerControl: $("#layerControl"),
  slider: $("#layerSlider"),
  layerValue: $("#layerValue"),
  layerCommandPanel: $("#layerCommandPanel"),
  layerCommandNumber: $("#layerCommandNumber"),
  layerCommandMode: $("#layerCommandMode"),
  layerCommandText: $("#layerCommandText"),
  layerCommandHint: $("#layerCommandHint"),
  saveLayerCommand: $("#saveLayerCommand"),
  removeLayerCommand: $("#removeLayerCommand"),
  closeLayerCommand: $("#closeLayerCommand"),
  layerCommandList: $("#layerCommandList"),
  form: $("#settingsForm"),
  printerProfile: $("#printerProfile"),
  firmwareProfile: $("#firmwareProfile"),
  excludeObjects: $("#excludeObjects"),
  slice: $("#sliceButton"),
  status: $("#statusMessage"),
  result: $("#resultPanel"),
  resultLayers: $("#resultLayers"),
  resultTime: $("#resultTime"),
  resultFilament: $("#resultFilament"),
  resultSize: $("#resultSize"),
  preview: $("#gcodePreview"),
  download: $("#downloadButton"),
  printToPrinter: $("#printToPrinterButton")
};

let model = null;
let selectedModelIndex = 0;
let nextObjectId = 1;
let editingLayer = 1;
let savedPrinters = [];
let editingSavedPrinterId = null;
let activePrinter = null;
let activeMoonrakerUrl = null;
let printerApiReady = false;
let printerConnectionSequence = 0;
let isUploadingToPrinter = false;
let sliced = null;
let currentObjectUrl = null;
let viewer = null;
let viewerMesh = null;
let viewerGrid = null;
let viewerExtent = 1;
let viewerBounds = null;
let viewerSettings = null;
let viewerLayerTop = 1;
let transformMode = null;
let transformRotationAxis = "rotationX";
const viewerCamera = { yaw: 0.72, pitch: 0.48, zoom: 1 };
const EPSILON = 1e-7;
const MAX_TOTAL_TRIANGLES = 500000;
const MAX_INSTANCES = 20;
const DEFAULT_START_GCODE = [
  "M140 S{BED_TEMP}",
  "M104 S{NOZZLE_TEMP}",
  "G90",
  "M82",
  "G28",
  "M190 S{BED_TEMP}",
  "M109 S{NOZZLE_TEMP}",
  "G92 E0"
].join("\n");
const KLIPPER_START_GCODE = "START_PRINT BED_TEMP={BED_TEMP} EXTRUDER_TEMP={NOZZLE_TEMP}";
const KLIPPER_END_GCODE = "END_PRINT";
const DEFAULT_END_GCODE = [
  "M104 S0",
  "M140 S0",
  "G0 X0 Y{BED_Y} F3000",
  "M84"
].join("\n");
const PRINTER_PROFILES = {
  ender3: { name: "Creality Ender 3 / Pro", x: 220, y: 220, z: 250, firmware: "marlin" },
  ender3v2: { name: "Creality Ender 3 V2", x: 220, y: 220, z: 250, firmware: "marlin" },
  ender3s1: { name: "Creality Ender 3 S1", x: 220, y: 220, z: 270, firmware: "marlin" },
  "prusa-mk3s": { name: "Prusa i3 MK3S / MK3S+", x: 250, y: 210, z: 210, firmware: "marlin" },
  kobra: { name: "Anycubic Kobra", x: 220, y: 220, z: 250, firmware: "marlin" },
  "biqu-b1": { name: "BIQU B1", x: 235, y: 235, z: 270, firmware: "marlin" },
  "biqu-b1-se-plus": { name: "BIQU B1 SE Plus", x: 310, y: 310, z: 340, firmware: "marlin" },
  "biqu-bx": { name: "BIQU BX", x: 250, y: 250, z: 250, firmware: "marlin" },
  "biqu-hurakan": { name: "BIQU Hurakan", x: 220, y: 220, z: 270, firmware: "klipper" }
};

function compileShader(gl, type, source) {
  const shader = gl.createShader(type);
  if (!shader) throw new Error("No se pudo crear el shader de la vista 3D.");
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader) || "Error desconocido al compilar el shader.";
    gl.deleteShader(shader);
    throw new Error(message);
  }
  return shader;
}

function initializeModelViewer() {
  const gl = ui.modelCanvas.getContext("webgl", { antialias: true, alpha: false });
  if (!gl) {
    ui.modelViewEmpty.textContent = "Este navegador no permite mostrar la vista 3D.";
    return;
  }
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, `
    attribute vec3 aPosition;
    attribute vec3 aNormal;
    attribute vec3 aColor;
    uniform mat4 uViewProjection;
    uniform float uLayerTop;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying float vHeight;
    void main() {
      gl_Position = uViewProjection * vec4(aPosition, 1.0);
      vNormal = aNormal;
      vColor = aColor;
      vHeight = aPosition.z;
    }
  `);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, `
    precision mediump float;
    varying vec3 vNormal;
    varying vec3 vColor;
    varying float vHeight;
    uniform float uLayerTop;
    void main() {
      if (vHeight > uLayerTop) discard;
      float normalLength = length(vNormal);
      float light = normalLength > 0.0
        ? 0.48 + 0.52 * abs(dot(normalize(vNormal), normalize(vec3(-0.45, -0.65, 0.8))))
        : 1.0;
      gl_FragColor = vec4(vColor * light, 1.0);
    }
  `);
  const program = gl.createProgram();
  if (!program) throw new Error("No se pudo crear el programa de la vista 3D.");
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) || "No se pudo enlazar el programa de la vista 3D.");
  }
  viewer = {
    gl,
    program,
    position: gl.getAttribLocation(program, "aPosition"),
    normal: gl.getAttribLocation(program, "aNormal"),
    color: gl.getAttribLocation(program, "aColor"),
    viewProjection: gl.getUniformLocation(program, "uViewProjection"),
    layerTop: gl.getUniformLocation(program, "uLayerTop")
  };
  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.clearColor(16 / 255, 22 / 255, 30 / 255, 1);
  renderModelView();
}

function automaticLayerCommand(firmware) {
  return firmware === "klipper" ? "PAUSE" : "M600";
}

function refreshLayerCommandHint() {
  const isAutomatic = ui.layerCommandMode.value === "automatic";
  ui.layerCommandText.readOnly = isAutomatic;
  if (isAutomatic) {
    const command = automaticLayerCommand(ui.firmwareProfile.value);
    ui.layerCommandText.value = command;
    ui.layerCommandHint.textContent = ui.firmwareProfile.value === "klipper"
      ? "Klipper insertará PAUSE para cambiar el filamento manualmente y reanudar. Verifica que tu configuración admita PAUSE."
      : "Marlin insertará M600. Comprueba que tu firmware tenga habilitado el cambio de filamento; de lo contrario, elige un comando personalizado.";
  } else {
    ui.layerCommandHint.textContent = "Se insertará el comando tal como lo escribas. Usa una macro de tu impresora o un comando de cambio de filamento que el firmware admita.";
  }
}

function renderLayerCommandList() {
  if (!model) return;
  ui.layerCommandList.replaceChildren();
  for (const entry of model.layerCommands) {
    const row = document.createElement("div");
    row.className = "layer-command-entry";
    const description = document.createElement("span");
    description.textContent = `Capa ${entry.layer} · ${entry.mode === "automatic" ? automaticLayerCommand(ui.firmwareProfile.value) : entry.command}`;
    const edit = document.createElement("button");
    edit.type = "button";
    edit.textContent = "Editar";
    edit.addEventListener("click", () => openLayerCommandEditor(entry.layer));
    row.append(description, edit);
    ui.layerCommandList.append(row);
  }
}

function openLayerCommandEditor(layer) {
  if (!model) {
    status("Carga primero un modelo STL para añadir un cambio de filamento.", "error");
    return;
  }
  const layerCount = Math.max(1, Number(ui.slider.max) + 1);
  editingLayer = Math.max(1, Math.min(layerCount, layer));
  const existing = model.layerCommands.find((entry) => entry.layer === editingLayer);
  ui.layerCommandNumber.textContent = String(editingLayer);
  ui.layerCommandMode.value = existing?.mode || "automatic";
  ui.layerCommandText.value = existing?.mode === "custom" ? existing.command : "";
  ui.layerCommandPanel.classList.remove("hidden");
  ui.removeLayerCommand.classList.toggle("hidden", !existing);
  refreshLayerCommandHint();
  renderLayerCommandList();
}

function saveLayerChangeCommand() {
  if (!model) return;
  const mode = ui.layerCommandMode.value;
  const command = mode === "automatic" ? "" : ui.layerCommandText.value.trim();
  if (mode === "custom" && (!command || command.length > 500 || /[\u0000]/.test(command))) {
    status("Escribe un comando G-code personalizado válido (máximo 500 caracteres).", "error");
    ui.layerCommandText.focus();
    return;
  }
  const entry = { layer: editingLayer, mode, command };
  const existingIndex = model.layerCommands.findIndex((item) => item.layer === editingLayer);
  if (existingIndex >= 0) model.layerCommands[existingIndex] = entry;
  else model.layerCommands.push(entry);
  model.layerCommands.sort((first, second) => first.layer - second.layer);
  renderLayerCommandList();
  ui.removeLayerCommand.classList.remove("hidden");
  markSliceOutOfDate();
  status(`Comando guardado para la capa ${editingLayer}. Vuelve a laminar para aplicarlo.`, "success");
}

function removeLayerChangeCommand() {
  if (!model) return;
  model.layerCommands = model.layerCommands.filter((entry) => entry.layer !== editingLayer);
  renderLayerCommandList();
  openLayerCommandEditor(editingLayer);
  markSliceOutOfDate();
  status(`Se quitó el cambio de filamento de la capa ${editingLayer}.`, "success");
}

function multiplyMatrices(a, b) {
  const result = new Float32Array(16);
  for (let column = 0; column < 4; column += 1) {
    for (let row = 0; row < 4; row += 1) {
      result[column * 4 + row] =
        a[row] * b[column * 4] +
        a[4 + row] * b[column * 4 + 1] +
        a[8 + row] * b[column * 4 + 2] +
        a[12 + row] * b[column * 4 + 3];
    }
  }
  return result;
}

function perspectiveMatrix(fieldOfView, aspect, near, far) {
  const f = 1 / Math.tan(fieldOfView / 2);
  const range = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (near + far) * range, -1,
    0, 0, 2 * near * far * range, 0
  ]);
}

function lookAtMatrix(eye, target) {
  const normalize = (vector) => {
    const length = Math.hypot(...vector) || 1;
    return vector.map((value) => value / length);
  };
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
  const subtract = (a, b) => a.map((value, index) => value - b[index]);
  const zAxis = normalize(subtract(eye, target));
  const xAxis = normalize(cross([0, 0, 1], zAxis));
  const yAxis = cross(zAxis, xAxis);
  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -xAxis[0] * eye[0] - xAxis[1] * eye[1] - xAxis[2] * eye[2],
    -yAxis[0] * eye[0] - yAxis[1] * eye[1] - yAxis[2] * eye[2],
    -zAxis[0] * eye[0] - zAxis[1] * eye[1] - zAxis[2] * eye[2],
    1
  ]);
}

function uploadViewerGeometry(positions, normals, colors) {
  const gl = viewer.gl;
  const buffers = [positions, normals, colors].map((data) => {
    const buffer = gl.createBuffer();
    if (!buffer) throw new Error("No se pudo reservar memoria para la vista 3D.");
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
    return buffer;
  });
  return { buffers, count: positions.length / 3 };
}

function disposeViewerGeometry(geometry) {
  if (viewer && geometry) {
    for (const buffer of geometry.buffers) viewer.gl.deleteBuffer(buffer);
  }
}

function settingsForInstance(settings, instance) {
  return {
    ...settings,
    modelScale: Number(ui.modelScale.value) * instance.scalePercent / 100,
    scalePercent: instance.scalePercent,
    rotationX: instance.rotationX,
    rotationY: instance.rotationY,
    rotationZ: instance.rotationZ,
    positionX: instance.positionX,
    positionY: instance.positionY,
    positionZ: instance.positionZ
  };
}

function transformInstances(settings) {
  return model.instances.map((instance) => ({
    instance,
    transformed: transformModel(settingsForInstance(settings, instance))
  }));
}

function combineBounds(items) {
  return items.reduce((bounds, item) => {
    for (let axis = 0; axis < 3; axis += 1) {
      bounds.min[axis] = Math.min(bounds.min[axis], item.transformed.bounds.min[axis]);
      bounds.max[axis] = Math.max(bounds.max[axis], item.transformed.bounds.max[axis]);
    }
    return bounds;
  }, { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] });
}

function colorComponents(hexColor) {
  const value = Number.parseInt(hexColor.slice(1), 16);
  return [(value >> 16 & 255) / 255, (value >> 8 & 255) / 255, (value & 255) / 255];
}

function buildModelViewGeometry(settings = readSettings(), transformedInstances = null) {
  if (!viewer || !model || !settings) return;
  transformedInstances = transformedInstances || transformInstances(settings);
  const bounds = combineBounds(transformedInstances);
  viewerSettings = settings;
  viewerBounds = bounds;
  viewerExtent = Math.max(
    settings.bedX,
    settings.bedY,
    bounds.max[2] - bounds.min[2],
    bounds.max[2],
    1
  );
  const positions = [];
  const normals = [];
  const colors = [];
  for (const { instance, transformed } of transformedInstances) {
    const color = colorComponents(instance.color);
    for (const triangle of transformed.triangles) {
      const vertices = triangle.map((point) => point.map((coordinate) => coordinate / viewerExtent));
      const edgeA = vertices[1].map((value, index) => value - vertices[0][index]);
      const edgeB = vertices[2].map((value, index) => value - vertices[0][index]);
      const normal = [
        edgeA[1] * edgeB[2] - edgeA[2] * edgeB[1],
        edgeA[2] * edgeB[0] - edgeA[0] * edgeB[2],
        edgeA[0] * edgeB[1] - edgeA[1] * edgeB[0]
      ];
      for (const vertex of vertices) {
        positions.push(...vertex);
        normals.push(...normal);
        colors.push(...color);
      }
    }
  }
  const nextMesh = uploadViewerGeometry(positions, normals, colors);
  disposeViewerGeometry(viewerMesh);
  viewerMesh = nextMesh;
  buildViewerGrid(settings);
  updateViewerLayerControl(settings, bounds);
  ui.modelViewEmpty.classList.add("hidden");
  renderModelView();
}

function buildViewerGrid(settings = readSettings()) {
  if (!viewer || !model) return;
  if (!settings) return;
  const bedX = settings.bedX / viewerExtent;
  const bedY = settings.bedY / viewerExtent;
  const grid = [];
  const gridColors = [];
  const gridNormals = [];
  const divisions = 10;
  const addLine = (x1, y1, x2, y2, color) => {
    grid.push(x1, y1, 0, x2, y2, 0);
    for (let vertex = 0; vertex < 2; vertex += 1) {
      gridColors.push(...color);
      gridNormals.push(0, 0, 0);
    }
  };
  for (let index = 0; index <= divisions; index += 1) {
    const x = bedX * index / divisions;
    const y = bedY * index / divisions;
    addLine(x, 0, x, bedY, [0.13, 0.18, 0.24]);
    addLine(0, y, bedX, y, [0.13, 0.18, 0.24]);
  }
  addLine(0, 0, bedX, 0, [0.3, 0.4, 0.5]);
  addLine(bedX, 0, bedX, bedY, [0.3, 0.4, 0.5]);
  addLine(bedX, bedY, 0, bedY, [0.3, 0.4, 0.5]);
  addLine(0, bedY, 0, 0, [0.3, 0.4, 0.5]);
  const nextGrid = uploadViewerGeometry(grid, gridNormals, gridColors);
  disposeViewerGeometry(viewerGrid);
  viewerGrid = nextGrid;
}

function updateViewerLayerControl(settings, bounds) {
  if (!model) {
    ui.layerControl.classList.add("hidden");
    return;
  }
  const height = bounds.max[2] - bounds.min[2];
  const count = Math.max(1, Math.ceil(height / settings.layerHeight));
  ui.slider.min = "0";
  ui.slider.max = String(count - 1);
  ui.slider.value = String(Math.min(Number(ui.slider.value) || 0, count - 1));
  ui.layerControl.classList.remove("hidden");
  updateViewerLayerTop(settings, bounds);
}

function updateViewerLayerTop(settings = viewerSettings, bounds = viewerBounds) {
  if (!settings || !bounds || !model) return;
  const count = Math.max(1, Math.ceil((bounds.max[2] - bounds.min[2]) / settings.layerHeight));
  const layer = Math.min(Number(ui.slider.value) || 0, count - 1);
  viewerLayerTop = (bounds.min[2] + Math.min((layer + 1) * settings.layerHeight, bounds.max[2] - bounds.min[2])) / viewerExtent;
  ui.layerValue.textContent = `${layer + 1} / ${count} · Z ${(viewerLayerTop * viewerExtent).toFixed(2)} mm`;
  renderModelView();
}

function drawViewerGeometry(geometry, mode) {
  const gl = viewer.gl;
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffers[0]);
  gl.enableVertexAttribArray(viewer.position);
  gl.vertexAttribPointer(viewer.position, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffers[1]);
  gl.enableVertexAttribArray(viewer.normal);
  gl.vertexAttribPointer(viewer.normal, 3, gl.FLOAT, false, 0, 0);
  gl.bindBuffer(gl.ARRAY_BUFFER, geometry.buffers[2]);
  gl.enableVertexAttribArray(viewer.color);
  gl.vertexAttribPointer(viewer.color, 3, gl.FLOAT, false, 0, 0);
  gl.drawArrays(mode, 0, geometry.count);
}

function renderModelView() {
  if (!viewer) return;
  const { gl } = viewer;
  const canvas = ui.modelCanvas;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
  const width = Math.max(1, Math.round(rect.width * pixelRatio));
  const height = Math.max(1, Math.round(rect.height * pixelRatio));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  gl.viewport(0, 0, width, height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  if (!viewerMesh || !viewerGrid) return;
  gl.useProgram(viewer.program);
  const bedX = Number($("#bedX").value) / viewerExtent;
  const bedY = Number($("#bedY").value) / viewerExtent;
  const centerZ = viewerBounds ? (viewerBounds.min[2] + viewerBounds.max[2]) / (2 * viewerExtent) : 0;
  const target = [bedX / 2, bedY / 2, centerZ];
  const distance = 2.6 / viewerCamera.zoom;
  const horizontalDistance = distance * Math.cos(viewerCamera.pitch);
  const eye = [
    target[0] + horizontalDistance * Math.cos(viewerCamera.yaw),
    target[1] + horizontalDistance * Math.sin(viewerCamera.yaw),
    target[2] + distance * Math.sin(viewerCamera.pitch)
  ];
  const projection = perspectiveMatrix(Math.PI / 4, width / height, 0.01, 100);
  const view = lookAtMatrix(eye, target);
  gl.uniformMatrix4fv(viewer.viewProjection, false, multiplyMatrices(projection, view));
  gl.uniform1f(viewer.layerTop, viewerLayerTop);
  drawViewerGeometry(viewerGrid, gl.LINES);
  drawViewerGeometry(viewerMesh, gl.TRIANGLES);
}

function adjustViewerZoom(factor) {
  viewerCamera.zoom = Math.min(5, Math.max(0.35, viewerCamera.zoom * factor));
  renderModelView();
}

function status(message, kind = "") {
  ui.status.textContent = message;
  ui.status.className = `status-message ${kind}`.trim();
}

function normalizePrinterUrl(value) {
  const address = value.trim();
  if (!address || /[\s\u0000-\u001f]/.test(address)) {
    throw new Error("Escribe una IP o dirección web válida.");
  }
  const url = new URL(/^[a-z][a-z\d+.-]*:\/\//i.test(address) ? address : `http://${address}`);
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new Error("Usa una dirección HTTP o HTTPS válida, sin usuario ni contraseña.");
  }
  return url;
}

function setPrinterStatus(message, isError = false) {
  ui.printerConnectionStatus.textContent = message;
  ui.printerConnectionStatus.className = `printer-connection-status${isError ? " error" : ""}`;
}

function setSavedPrintersCollapsed(collapsed) {
  ui.savedPrintersContent.classList.toggle("hidden", collapsed);
  ui.toggleSavedPrinters.setAttribute("aria-expanded", String(!collapsed));
  ui.toggleSavedPrinters.setAttribute(
    "aria-label",
    `${collapsed ? "Mostrar" : "Ocultar"} impresoras guardadas`
  );
  ui.toggleSavedPrinters.querySelector(".collapse-toggle-label").textContent = collapsed ? "Mostrar" : "Ocultar";
}

function updatePrinterPrintButton() {
  const isConnected = Boolean(activePrinter && activeMoonrakerUrl && sliced);
  const hasKlipperGcode = isConnected && sliced.settings.firmwareProfile === "klipper";
  ui.printToPrinter.classList.toggle("hidden", !isConnected);
  ui.printToPrinter.disabled = !printerApiReady || !hasKlipperGcode || isUploadingToPrinter;
  ui.printToPrinter.title = !printerApiReady
    ? "Klipper no está listo para imprimir."
    : !hasKlipperGcode
      ? "Selecciona Klipper como firmware y vuelve a laminar el modelo."
      : "";
}

function showAppView(view) {
  const showPrinter = view === "printer";
  ui.laminatorView.classList.toggle("hidden", showPrinter);
  ui.printerView.classList.toggle("hidden", !showPrinter);
  ui.laminatorTab.classList.toggle("active", !showPrinter);
  ui.printerTab.classList.toggle("active", showPrinter);
  ui.laminatorTab.setAttribute("aria-pressed", String(!showPrinter));
  ui.printerTab.setAttribute("aria-pressed", String(showPrinter));
  if (showPrinter) {
    if (!editingSavedPrinterId) ui.savedPrinterName.value = $("#printerName").value.trim();
    renderSavedPrinters();
  } else {
    renderModelView();
  }
}

function capturePrinterConfiguration() {
  return {
    profile: ui.printerProfile.value,
    firmware: ui.firmwareProfile.value,
    printerName: $("#printerName").value.trim(),
    bedX: $("#bedX").value,
    bedY: $("#bedY").value,
    bedZ: $("#bedZ").value,
    layerHeight: $("#layerHeight").value,
    nozzle: $("#nozzle").value,
    infill: $("#infill").value,
    filament: $("#filament").value,
    nozzleTemp: $("#nozzleTemp").value,
    bedTemp: $("#bedTemp").value,
    printSpeed: $("#printSpeed").value,
    excludeObjects: ui.excludeObjects.checked,
    startGcode: $("#startGcode").value,
    endGcode: $("#endGcode").value
  };
}

function applyPrinterConfiguration(configuration) {
  const values = {
    printerProfile: configuration.profile,
    firmwareProfile: configuration.firmware,
    printerName: configuration.printerName,
    bedX: configuration.bedX,
    bedY: configuration.bedY,
    bedZ: configuration.bedZ,
    layerHeight: configuration.layerHeight,
    nozzle: configuration.nozzle,
    infill: configuration.infill,
    filament: configuration.filament,
    nozzleTemp: configuration.nozzleTemp,
    bedTemp: configuration.bedTemp,
    printSpeed: configuration.printSpeed,
    startGcode: configuration.startGcode,
    endGcode: configuration.endGcode
  };
  for (const [id, value] of Object.entries(values)) {
    const control = $(`#${id}`);
    if (typeof value === "string" && control) control.value = value;
  }
  if (!ui.printerProfile.value) ui.printerProfile.value = "custom";
  if (!ui.firmwareProfile.value) ui.firmwareProfile.value = "marlin";
  ui.excludeObjects.checked = configuration.excludeObjects === true && ui.firmwareProfile.value === "klipper";
  updateExcludeObjectsControl();
  if (model) updateModelScale();
  markSliceOutOfDate();
}

function renderSavedPrinters() {
  ui.savedPrintersList.replaceChildren();
  if (!savedPrinters.length) {
    const empty = document.createElement("p");
    empty.className = "saved-printers-empty";
    empty.textContent = "Todavía no guardaste impresoras. Selecciona un perfil en «LAMINADOR 3D» y guárdalo aquí.";
    ui.savedPrintersList.append(empty);
    return;
  }
  for (const printer of savedPrinters) {
    const card = document.createElement("article");
    card.className = "saved-printer-card";
    const details = document.createElement("div");
    details.className = "saved-printer-details";
    const title = document.createElement("strong");
    title.textContent = printer.name;
    const profile = document.createElement("span");
    const configuration = printer.configuration;
    profile.textContent = [
      configuration.printerName || "Impresora",
      `${configuration.bedX} × ${configuration.bedY} × ${configuration.bedZ} mm`,
      configuration.firmware === "klipper" ? "Klipper" : "Marlin"
    ].join(" · ");
    const address = document.createElement("small");
    address.textContent = printer.url || "Sin panel web guardado";
    details.append(title, profile, address);
    const actions = document.createElement("div");
    actions.className = "saved-printer-card-actions";
    const addAction = (label, action, disabled = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.dataset.printerAction = action;
      button.dataset.printerId = printer.id;
      button.disabled = disabled;
      actions.append(button);
    };
    addAction("Conectar", "connect", !printer.url);
    addAction("Usar en laminador", "use");
    addAction("Editar", "edit");
    addAction("Eliminar", "delete");
    card.append(details, actions);
    ui.savedPrintersList.append(card);
  }
}

function loadSavedPrinters() {
  const stored = localStorage.getItem("compilar-stl-saved-printers");
  if (stored) {
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) throw new Error("La lista guardada de impresoras no tiene un formato válido.");
    savedPrinters = parsed.map((printer) => {
      if (!printer || typeof printer.id !== "string" || typeof printer.name !== "string" ||
          typeof printer.configuration !== "object" || !printer.configuration) {
        throw new Error("Hay una impresora guardada con datos incompletos.");
      }
      return {
        id: printer.id,
        name: printer.name,
        url: typeof printer.url === "string" && printer.url ? normalizePrinterUrl(printer.url).href : "",
        configuration: printer.configuration
      };
    });
  }
  renderSavedPrinters();
}

function savePrinterConfiguration(event) {
  event.preventDefault();
  const name = ui.savedPrinterName.value.trim();
  if (!name || name.length > 60) {
    setPrinterStatus("Escribe un nombre de hasta 60 caracteres para guardar esta impresora.", true);
    ui.savedPrinterName.focus();
    return;
  }
  let url = "";
  try {
    if (ui.printerAddress.value.trim()) url = normalizePrinterUrl(ui.printerAddress.value).href;
  } catch (error) {
    setPrinterStatus(error instanceof Error ? error.message : "La dirección de la impresora no es válida.", true);
    ui.printerAddress.focus();
    return;
  }

  const existingIndex = savedPrinters.findIndex((printer) =>
    printer.id === editingSavedPrinterId || (url && printer.url === url)
  );
  const id = existingIndex >= 0 ? savedPrinters[existingIndex].id : `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const printer = {
    id,
    name,
    url,
    configuration: capturePrinterConfiguration()
  };
  const nextPrinters = [...savedPrinters];
  if (existingIndex >= 0) nextPrinters[existingIndex] = printer;
  else nextPrinters.push(printer);
  try {
    localStorage.setItem("compilar-stl-saved-printers", JSON.stringify(nextPrinters));
  } catch (error) {
    console.error("No se pudo guardar la impresora en este dispositivo.", error);
    setPrinterStatus("No se pudo guardar la impresora. Comprueba el espacio disponible del navegador.", true);
    return;
  }
  savedPrinters = nextPrinters;
  if (activePrinter && activePrinter.id === printer.id) {
    activePrinter = null;
    activeMoonrakerUrl = null;
    printerApiReady = false;
    printerConnectionSequence += 1;
    updatePrinterPrintButton();
  }
  editingSavedPrinterId = id;
  ui.printerAddress.value = url;
  ui.cancelSavedPrinterEdit.classList.remove("hidden");
  renderSavedPrinters();
  setPrinterStatus(`Se guardó «${name}» con la configuración actual del laminador${url ? ` y la dirección ${url}` : ""}.`);
}

function cancelPrinterEdit() {
  editingSavedPrinterId = null;
  ui.savedPrinterForm.reset();
  ui.savedPrinterName.value = $("#printerName").value.trim();
  ui.cancelSavedPrinterEdit.classList.add("hidden");
  setPrinterStatus("La dirección y las configuraciones se guardan solo en este dispositivo.");
}

async function connectSavedPrinter(printer) {
  if (!printer.url) {
    setPrinterStatus("Edita esta impresora y añade la dirección de su panel web para conectarla.", true);
    return;
  }
  let url;
  try {
    url = normalizePrinterUrl(printer.url);
  } catch (error) {
    setPrinterStatus(error instanceof Error ? error.message : "La dirección guardada no es válida.", true);
    return;
  }
  ui.printerFrame.src = url.href;
  ui.printerFrame.classList.remove("hidden");
  ui.printerFrameEmpty.classList.add("hidden");
  ui.externalPrinterLink.href = url.href;
  ui.externalPrinterLink.classList.remove("hidden");
  setSavedPrintersCollapsed(true);
  activePrinter = printer;
  activeMoonrakerUrl = null;
  printerApiReady = false;
  const connectionSequence = ++printerConnectionSequence;
  updatePrinterPrintButton();
  setPrinterStatus(`Cargando el panel de «${printer.name}» y comprobando la conexión Moonraker…`);
  const apiUrls = [new URL("/server/info", url.origin)];
  const moonrakerUrl = new URL("/server/info", url.origin);
  moonrakerUrl.protocol = "http:";
  moonrakerUrl.port = "7125";
  if (!apiUrls.some((candidate) => candidate.href === moonrakerUrl.href)) apiUrls.push(moonrakerUrl);
  const errors = [];
  for (const apiUrl of apiUrls) {
    try {
      const response = await fetchWithTimeout(apiUrl, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`Moonraker respondió HTTP ${response.status}.`);
      const payload = await response.json();
      const info = payload.result || payload;
      if (typeof info.klippy_state !== "string") throw new Error("La respuesta no parece ser de Moonraker.");
      if (connectionSequence !== printerConnectionSequence) return;
      activeMoonrakerUrl = apiUrl;
      printerApiReady = info.klippy_state === "ready";
      updatePrinterPrintButton();
      if (printerApiReady) {
        setPrinterStatus(`«${printer.name}» está conectada a Klipper. Lamina un archivo para habilitar «Cargar e imprimir».`);
      } else {
        setPrinterStatus(`Moonraker responde, pero Klipper indica «${info.klippy_state}» y no está listo para imprimir.`, true);
      }
      return;
    } catch (error) {
      errors.push(error instanceof Error ? error.message : "Error de conexión con Moonraker.");
    }
  }
  if (connectionSequence !== printerConnectionSequence) return;
  updatePrinterPrintButton();
  console.warn("No se pudo confirmar la conexión con Moonraker.", errors);
  setPrinterStatus(
    `El panel web puede seguir abierto, pero no se pudo conectar con Moonraker. Comprueba el puerto 7125, CORS/acceso de red y que la app no esté en HTTPS mientras la impresora usa HTTP. ${errors[errors.length - 1] || ""}`,
    true
  );
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
}

async function uploadAndPrint() {
  if (!sliced || !activePrinter || !activeMoonrakerUrl || !printerApiReady) {
    status("Conecta y confirma una impresora Klipper lista antes de imprimir.", "error");
    return;
  }
  if (sliced.settings.firmwareProfile !== "klipper") {
    status("El G-code se laminó para otro firmware. Selecciona Klipper y vuelve a laminar antes de enviar.", "error");
    return;
  }
  const safeName = model.name.replace(/\.stl$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100);
  const fileName = `${safeName || "modelo"}.gcode`;
  if (!window.confirm(`Se enviará «${fileName}» a «${activePrinter.name}» y Klipper comenzará a imprimir. ¿Continuar?`)) return;
  const formData = new FormData();
  formData.append("file", new Blob([sliced.text], { type: "text/plain" }), fileName);
  const uploadUrl = new URL("/server/files/upload?root=gcodes&print=true", activeMoonrakerUrl.origin);
  isUploadingToPrinter = true;
  updatePrinterPrintButton();
  status(`Enviando «${fileName}» a «${activePrinter.name}»…`);
  try {
    const response = await fetchWithTimeout(uploadUrl, { method: "POST", body: formData }, 120000);
    const responseText = await response.text();
    if (!response.ok) throw new Error(`Moonraker respondió HTTP ${response.status}${responseText ? `: ${responseText.slice(0, 240)}` : "."}`);
    let result;
    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      throw new Error("Moonraker respondió con un formato inesperado al cargar el archivo.");
    }
    if (result.error) throw new Error(result.error.message || "Moonraker rechazó el archivo.");
    status(`«${fileName}» se cargó en «${activePrinter.name}» y se envió a imprimir.`, "success");
  } catch (error) {
    console.error("No se pudo cargar e imprimir el G-code en Moonraker.", error);
    status(error instanceof Error
      ? `No se pudo cargar e imprimir: ${error.message}. Revisa conexión, permisos de Moonraker, CORS y el estado de Klipper.`
      : "No se pudo cargar e imprimir el G-code. Revisa la conexión de Moonraker.", "error");
  } finally {
    isUploadingToPrinter = false;
    updatePrinterPrintButton();
  }
}

function handleSavedPrinterAction(event) {
  const button = event.target.closest("[data-printer-action]");
  if (!button) return;
  const printer = savedPrinters.find((item) => item.id === button.dataset.printerId);
  if (!printer) return;
  if (button.dataset.printerAction === "connect") {
    connectSavedPrinter(printer);
  } else if (button.dataset.printerAction === "use") {
    applyPrinterConfiguration(printer.configuration);
    showAppView("laminator");
    setPrinterStatus(`Se cargó «${printer.name}» en el laminador.`);
  } else if (button.dataset.printerAction === "edit") {
    setSavedPrintersCollapsed(false);
    editingSavedPrinterId = printer.id;
    ui.savedPrinterName.value = printer.name;
    ui.printerAddress.value = printer.url;
    ui.cancelSavedPrinterEdit.classList.remove("hidden");
    setPrinterStatus(`Editando «${printer.name}». Para cambiar su configuración, usa «Usar en laminador», ajústala y guárdala de nuevo.`);
  } else if (button.dataset.printerAction === "delete") {
    const nextPrinters = savedPrinters.filter((item) => item.id !== printer.id);
    try {
      localStorage.setItem("compilar-stl-saved-printers", JSON.stringify(nextPrinters));
    } catch (error) {
      console.error("No se pudo actualizar la lista de impresoras guardadas.", error);
      setPrinterStatus("No se pudo eliminar la impresora de la lista guardada.", true);
      return;
    }
    savedPrinters = nextPrinters;
    if (editingSavedPrinterId === printer.id) cancelPrinterEdit();
    renderSavedPrinters();
    setPrinterStatus(`Se quitó «${printer.name}» de las impresoras guardadas.`);
  }
}

function parseStl(buffer) {
  if (buffer.byteLength < 15) throw new Error("El archivo está vacío o no parece ser un STL válido.");
  const view = new DataView(buffer);
  const triangleCount = buffer.byteLength >= 84 ? view.getUint32(80, true) : 0;
  const expectedBinaryLength = 84 + triangleCount * 50;
  const startsAsAscii = new TextDecoder().decode(buffer.slice(0, 5)).toLowerCase() === "solid";
  const isBinary = triangleCount > 0 && expectedBinaryLength <= buffer.byteLength &&
    (expectedBinaryLength === buffer.byteLength || !startsAsAscii);
  const triangles = [];

  if (isBinary) {
    if (triangleCount > 250000) throw new Error("El modelo supera el límite inicial de 250.000 triángulos.");
    for (let index = 0, offset = 84; index < triangleCount; index += 1, offset += 50) {
      const points = [];
      for (let vertex = 0; vertex < 3; vertex += 1) {
        const start = offset + 12 + vertex * 12;
        points.push([
          view.getFloat32(start, true),
          view.getFloat32(start + 4, true),
          view.getFloat32(start + 8, true)
        ]);
      }
      triangles.push(points);
    }
  } else {
    const text = new TextDecoder().decode(buffer);
    const matches = text.matchAll(/vertex\s+([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s+([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)\s+([-+]?(?:\d*\.?\d+)(?:e[-+]?\d+)?)/gi);
    let current = [];
    for (const match of matches) {
      current.push([Number(match[1]), Number(match[2]), Number(match[3])]);
      if (current.length === 3) {
        triangles.push(current);
        current = [];
      }
    }
    if (current.length) throw new Error("El STL ASCII tiene una faceta incompleta.");
  }

  if (!triangles.length) throw new Error("No se encontraron triángulos en el archivo STL.");
  if (triangles.length > 250000) throw new Error("El modelo supera el límite inicial de 250.000 triángulos.");
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const triangle of triangles) {
    for (const point of triangle) {
      if (!point.every(Number.isFinite)) throw new Error("El STL contiene coordenadas no válidas.");
      point.forEach((coordinate, axis) => {
        min[axis] = Math.min(min[axis], coordinate);
        max[axis] = Math.max(max[axis], coordinate);
      });
    }
  }
  const size = max.map((value, axis) => value - min[axis]);
  if (size.some((value) => value <= EPSILON)) throw new Error("El modelo tiene dimensiones nulas y no se puede laminar.");
  return { triangles, min, max, size };
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function readSettings(showErrors = false) {
  const value = (id) => Number($(`#${id}`).value);
  const settings = {
    printerName: $("#printerName").value.trim() || "Impresora FDM",
    bedX: value("bedX"),
    bedY: value("bedY"),
    bedZ: value("bedZ"),
    firmwareProfile: ui.firmwareProfile.value,
    excludeObjects: ui.excludeObjects.checked,
    layerCommands: model ? model.layerCommands : [],
    modelScale: Number(ui.modelScale.value) * value("scalePercent") / 100,
    scalePercent: value("scalePercent"),
    rotationZ: value("rotationZ"),
    rotationX: value("rotationX"),
    rotationY: value("rotationY"),
    positionX: value("positionX"),
    positionY: value("positionY"),
    positionZ: value("positionZ"),
    layerHeight: value("layerHeight"),
    nozzle: value("nozzle"),
    infill: value("infill"),
    filament: value("filament"),
    nozzleTemp: value("nozzleTemp"),
    bedTemp: value("bedTemp"),
    speed: value("printSpeed"),
    startGcode: $("#startGcode").value,
    endGcode: $("#endGcode").value
  };
  const isFormValid = showErrors ? ui.form.reportValidity() : ui.form.checkValidity();
  const transformInputs = [
    ui.modelScale, ui.scalePercent, ui.rotationX, ui.rotationY, ui.rotationZ,
    ui.positionX, ui.positionY, ui.positionZ
  ];
  const areTransformsValid = transformInputs.every((input) => {
    const valid = input.checkValidity();
    if (showErrors && !valid) input.reportValidity();
    return valid;
  });
  if (!isFormValid || !areTransformsValid) return null;
  return settings;
}

function transformModel(settings) {
  const factor = settings.modelScale;
  const radiansX = settings.rotationX * Math.PI / 180;
  const radiansY = settings.rotationY * Math.PI / 180;
  const radiansZ = settings.rotationZ * Math.PI / 180;
  const cosX = Math.cos(radiansX);
  const sinX = Math.sin(radiansX);
  const cosY = Math.cos(radiansY);
  const sinY = Math.sin(radiansY);
  const cosZ = Math.cos(radiansZ);
  const sinZ = Math.sin(radiansZ);
  const center = model.min.map((value, axis) => (value + model.max[axis]) / 2);
  let localMinZ = Infinity;
  const rotate = (point) => {
    const x = (point[0] - center[0]) * factor;
    const y = (point[1] - center[1]) * factor;
    const z = (point[2] - center[2]) * factor;
    const rotatedY = y * cosX - z * sinX;
    const rotatedZx = y * sinX + z * cosX;
    const rotatedX = x * cosY + rotatedZx * sinY;
    const rotatedZ = -x * sinY + rotatedZx * cosY;
    const finalX = rotatedX * cosZ - rotatedY * sinZ;
    const finalY = rotatedX * sinZ + rotatedY * cosZ;
    localMinZ = Math.min(localMinZ, rotatedZ);
    return [finalX, finalY, rotatedZ];
  };
  const localTriangles = model.triangles.map((triangle) => triangle.map(rotate));
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  const triangles = localTriangles.map((triangle) => triangle.map(([x, y, z]) => {
    const transformed = [
      settings.bedX / 2 + settings.positionX + x,
      settings.bedY / 2 + settings.positionY + y,
      settings.positionZ + z - localMinZ
    ];
    transformed.forEach((coordinate, axis) => {
      min[axis] = Math.min(min[axis], coordinate);
      max[axis] = Math.max(max[axis], coordinate);
    });
    return transformed;
  }));
  return { triangles, bounds: { min, max } };
}

function isModelInsideBed(bounds, settings) {
  const tolerance = 1e-5;
  return bounds.min[0] >= -tolerance && bounds.min[1] >= -tolerance &&
    bounds.max[0] <= settings.bedX + tolerance &&
    bounds.max[1] <= settings.bedY + tolerance &&
    bounds.min[2] >= -tolerance && bounds.max[2] <= settings.bedZ + tolerance;
}

function expandGcodeTemplate(template, settings) {
  const values = {
    BED_TEMP: settings.bedTemp,
    NOZZLE_TEMP: settings.nozzleTemp,
    BED_X: settings.bedX.toFixed(1),
    BED_Y: settings.bedY.toFixed(1),
    PRINTER: settings.printerName.replace(/[\r\n;]/g, " ")
  };
  return template.replace(/\{(BED_TEMP|NOZZLE_TEMP|BED_X|BED_Y|PRINTER)\}/g, (_, key) => values[key]);
}

function pointKey(point) {
  return `${Math.round(point[0] * 10000)},${Math.round(point[1] * 10000)}`;
}

function intersectTriangle(triangle, z) {
  const points = [];
  for (let index = 0; index < 3; index += 1) {
    const first = triangle[index];
    const second = triangle[(index + 1) % 3];
    if ((first[2] <= z && second[2] > z) || (second[2] <= z && first[2] > z)) {
      const ratio = (z - first[2]) / (second[2] - first[2]);
      const point = [first[0] + ratio * (second[0] - first[0]), first[1] + ratio * (second[1] - first[1])];
      if (!points.some((other) => Math.hypot(other[0] - point[0], other[1] - point[1]) < 1e-5)) points.push(point);
    }
  }
  return points.length === 2 ? points : null;
}

function stitchSegments(segments) {
  const adjacency = new Map();
  for (let index = 0; index < segments.length; index += 1) {
    for (let end = 0; end < 2; end += 1) {
      const point = segments[index][end];
      const key = pointKey(point);
      if (!adjacency.has(key)) adjacency.set(key, []);
      adjacency.get(key).push({ index, end });
    }
  }
  const used = new Uint8Array(segments.length);
  const loops = [];
  for (let startIndex = 0; startIndex < segments.length; startIndex += 1) {
    if (used[startIndex]) continue;
    used[startIndex] = 1;
    const start = segments[startIndex][0];
    let current = segments[startIndex][1];
    const points = [start, current];
    let closed = pointKey(current) === pointKey(start);
    let guard = 0;
    while (!closed && guard++ <= segments.length) {
      const candidates = adjacency.get(pointKey(current)) || [];
      const next = candidates.find((candidate) => !used[candidate.index]);
      if (!next) break;
      used[next.index] = 1;
      current = segments[next.index][1 - next.end];
      if (pointKey(current) === pointKey(start)) {
        closed = true;
      } else {
        points.push(current);
      }
    }
    if (closed && points.length >= 3) loops.push(points);
  }
  return loops;
}

function infillSegments(loops, spacing, yStart, reverse) {
  const bounds = loops.flatMap((loop) => loop);
  if (!bounds.length || spacing <= 0) return [];
  let minY = Infinity;
  let maxY = -Infinity;
  for (const point of bounds) {
    minY = Math.min(minY, point[1]);
    maxY = Math.max(maxY, point[1]);
  }
  const paths = [];
  const firstIndex = Math.ceil((minY + spacing * 0.5 - yStart) / spacing);
  for (let scanIndex = firstIndex, y = yStart + scanIndex * spacing; y < maxY; scanIndex += 1, y = yStart + scanIndex * spacing) {
    const intersections = [];
    for (const loop of loops) {
      for (let index = 0; index < loop.length; index += 1) {
        const a = loop[index];
        const b = loop[(index + 1) % loop.length];
        if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
          intersections.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
        }
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i + 1 < intersections.length; i += 2) {
      if (intersections[i + 1] - intersections[i] > spacing * 0.15) {
        const from = [intersections[i], y];
        const to = [intersections[i + 1], y];
        paths.push(reverse ? [to, from] : [from, to]);
      }
    }
  }
  if (reverse) paths.reverse();
  return paths;
}

function distance(a, b) {
  return Math.hypot(b[0] - a[0], b[1] - a[1]);
}

function makeGcode(triangles, settings, layerCount, transformedInstances = []) {
  const lines = [
    `; Compilar STL - laminador beta`,
    `; Perfil: ${settings.printerName.replace(/[\r\n;]/g, " ")}`,
    `; Capas: ${layerCount} | Altura: ${settings.layerHeight.toFixed(2)} mm`,
    `; Escala STL aplicada: x${settings.modelScale.toFixed(3)}`,
    `; Rotacion XYZ: ${settings.rotationX}, ${settings.rotationY}, ${settings.rotationZ} grados`,
    `; Posicion XYZ: ${settings.positionX}, ${settings.positionY}, ${settings.positionZ} mm`,
    `; Relleno lineal: ${settings.infill}% | Boquilla: ${settings.nozzle.toFixed(2)} mm`,
    `; Aviso: una pared, sin compensacion de boquilla ni soportes`,
    `; Cambios de filamento por capa: ${settings.layerCommands.length}`
  ];
  const objectRuns = settings.excludeObjects
    ? transformedInstances.map(({ transformed }, index) => ({
      name: `object_${index + 1}`,
      triangles: transformed.triangles,
      bounds: transformed.bounds
    }))
    : [{ name: "", triangles }];
  if (settings.excludeObjects) {
    lines.push("; Klipper object exclusion: EXCLUDE_OBJECT_DEFINE/START/END");
    for (const object of objectRuns) {
      const { min, max } = object.bounds;
      const centerX = ((min[0] + max[0]) / 2).toFixed(3);
      const centerY = ((min[1] + max[1]) / 2).toFixed(3);
      const polygon = [
        [min[0], min[1]],
        [max[0], min[1]],
        [max[0], max[1]],
        [min[0], max[1]]
      ].map(([x, y]) => `[${x.toFixed(3)},${y.toFixed(3)}]`).join(",");
      lines.push(`EXCLUDE_OBJECT_DEFINE NAME=${object.name} CENTER=${centerX},${centerY} POLYGON=[${polygon}]`);
    }
  }
  lines.push(...expandGcodeTemplate(settings.startGcode, settings).split(/\r?\n/));
  if (settings.firmwareProfile === "klipper") {
    lines.push(`SET_PRINT_STATS_INFO TOTAL_LAYER=${layerCount}`);
  }
  const filamentArea = Math.PI * (settings.filament / 2) ** 2;
  const lineWidth = settings.nozzle * 1.05;
  let modelBase = Infinity;
  let modelTop = -Infinity;
  for (const triangle of triangles) {
    for (const point of triangle) {
      modelBase = Math.min(modelBase, point[2]);
      modelTop = Math.max(modelTop, point[2]);
    }
  }
  const modelHeight = modelTop - modelBase;
  let extrusion = 0;
  let totalPath = 0;
  const contoursByLayer = [];

  for (let layer = 0; layer < layerCount; layer += 1) {
    const actualLayerHeight = Math.min(settings.layerHeight, modelHeight - layer * settings.layerHeight);
    const layerExtrusionPerMm = (lineWidth * actualLayerHeight * 0.96) / filamentArea;
    const z = Math.min(modelBase + (layer + 0.5) * settings.layerHeight, modelTop - Math.min(1e-5, settings.layerHeight * 0.01));
    const layerObjects = objectRuns.map((object) => {
      const segments = [];
      for (const triangle of object.triangles) {
        const section = intersectTriangle(triangle, z);
        if (section) segments.push(section);
      }
      return { name: object.name, loops: stitchSegments(segments) };
    });
    const loops = layerObjects.flatMap((object) => object.loops);
    contoursByLayer.push(loops);
    const layerCommands = settings.layerCommands.filter((entry) => entry.layer === layer + 1);
    const layerZ = Math.min(modelBase + (layer + 1) * settings.layerHeight, modelTop);
    if (loops.length || layerCommands.length) {
      lines.push(`; capa ${layer + 1}/${layerCount}`, `G0 Z${layerZ.toFixed(3)} F${Math.round(settings.speed * 60)}`);
    }
    if (settings.firmwareProfile === "klipper") {
      lines.push(`SET_PRINT_STATS_INFO CURRENT_LAYER=${layer + 1}`);
    }
    for (const entry of layerCommands) {
      const command = entry.mode === "automatic" ? automaticLayerCommand(settings.firmwareProfile) : entry.command;
      lines.push(`; Cambio de filamento en capa ${entry.layer}`, ...command.split(/\r?\n/));
    }
    if (!loops.length) continue;
    for (const object of layerObjects) {
      if (!object.loops.length) continue;
      if (object.name) lines.push(`EXCLUDE_OBJECT_START NAME=${object.name}`);
      for (const loop of object.loops) {
        if (!loop.length) continue;
        const start = loop[0];
        lines.push(`G0 X${start[0].toFixed(3)} Y${start[1].toFixed(3)} F${Math.round(settings.speed * 60)}`);
        const closedLoop = [...loop, start];
        for (let index = 1; index < closedLoop.length; index += 1) {
          const from = closedLoop[index - 1];
          const to = closedLoop[index];
          const length = distance(from, to);
          if (length < 1e-5) continue;
          totalPath += length;
          extrusion += length * layerExtrusionPerMm;
          lines.push(`G1 X${to[0].toFixed(3)} Y${to[1].toFixed(3)} E${extrusion.toFixed(5)} F${Math.round(settings.speed * 60)}`);
        }
      }
      if (settings.infill > 0) {
        const spacing = lineWidth / (settings.infill / 100);
        const fills = infillSegments(object.loops, spacing, 0, layer % 2 === 1);
        for (const path of fills) {
          const [from, to] = path;
          lines.push(`G0 X${from[0].toFixed(3)} Y${from[1].toFixed(3)} F${Math.round(settings.speed * 60)}`);
          const length = distance(from, to);
          totalPath += length;
          extrusion += length * layerExtrusionPerMm;
          lines.push(`G1 X${to[0].toFixed(3)} Y${to[1].toFixed(3)} E${extrusion.toFixed(5)} F${Math.round(settings.speed * 60)}`);
        }
      }
      if (object.name) lines.push("EXCLUDE_OBJECT_END NAME=" + object.name);
    }
  }
  lines.push(
    ...expandGcodeTemplate(settings.endGcode, settings).split(/\r?\n/),
    `; Filamento estimado: ${(extrusion * Math.PI * (settings.filament / 2) ** 2 / 1000).toFixed(2)} cm3`
  );
  return { text: lines.join("\n") + "\n", contoursByLayer, filamentMm: extrusion, totalPath };
}

function saveSelectedInstance(settings = readSettings()) {
  if (!model || !settings) return;
  Object.assign(model.instances[selectedModelIndex], {
    scalePercent: settings.scalePercent,
    rotationX: settings.rotationX,
    rotationY: settings.rotationY,
    rotationZ: settings.rotationZ,
    positionX: settings.positionX,
    positionY: settings.positionY,
    positionZ: settings.positionZ
  });
}

function loadSelectedInstance() {
  if (!model) return;
  const instance = model.instances[selectedModelIndex];
  ui.scalePercent.value = String(instance.scalePercent);
  ui.rotationX.value = String(instance.rotationX);
  ui.rotationY.value = String(instance.rotationY);
  ui.rotationZ.value = String(instance.rotationZ);
  ui.positionX.value = String(instance.positionX);
  ui.positionY.value = String(instance.positionY);
  ui.positionZ.value = String(instance.positionZ);
  ui.objectColor.value = instance.color;
}

function refreshObjectControls() {
  if (!model) return;
  ui.objectSelect.replaceChildren(...model.instances.map((instance, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = instance.name;
    return option;
  }));
  ui.objectSelect.value = String(selectedModelIndex);
  ui.objectColor.value = model.instances[selectedModelIndex].color;
  const totalTriangles = model.triangles.length * model.instances.length;
  ui.duplicateObject.disabled = model.instances.length >= MAX_INSTANCES || totalTriangles + model.triangles.length > MAX_TOTAL_TRIANGLES;
  ui.duplicateObject.title = ui.duplicateObject.disabled && totalTriangles + model.triangles.length > MAX_TOTAL_TRIANGLES
    ? `Límite de vista y laminado: ${MAX_TOTAL_TRIANGLES.toLocaleString("es")} triángulos en total.`
    : "";
  ui.deleteObject.disabled = model.instances.length <= 1;
}

function updateModelScale(invalidateSlice = true) {
  if (!model) return;
  const multiplier = Number(ui.modelScale.value);
  const settings = readSettings();
  if (!settings) {
    ui.slice.disabled = true;
    return;
  }
  saveSelectedInstance(settings);
  const transformedInstances = transformInstances(settings);
  const transformed = transformedInstances[selectedModelIndex].transformed;
  const size = transformed.bounds.max.map((dimension, index) => dimension - transformed.bounds.min[index]);
  size.forEach((dimension, index) => { ui.dimensions[index].textContent = dimension.toFixed(2); });
  const unitName = ui.modelScale.selectedOptions[0].textContent;
  const unitMessage = multiplier === 1000 && Math.max(...model.size) < 1
    ? ` Archivo muy pequeño: se sugiere ${unitName}. El STL no guarda unidades; confirma que las dimensiones sean correctas.`
    : ` Se interpreta como ${unitName}; el STL no guarda unidades.`;
  const outOfBed = transformedInstances.some((item) => !isModelInsideBed(item.transformed.bounds, settings));
  const inBed = !outOfBed;
  const positionMessage = inBed
    ? ""
    : ` Al menos un objeto queda fuera de la cama o supera su altura Z (cama ${settings.bedX} × ${settings.bedY} × ${settings.bedZ} mm); acomódalos antes de laminar.`;
  ui.notice.textContent = `${size.map((dimension) => dimension.toFixed(2)).join(" × ")} mm · ${model.instances.length} objeto(s).${unitMessage}${positionMessage}`;
  ui.notice.className = `notice ${!inBed || (multiplier === 1000 && Math.max(...model.size) < 1) ? "" : "info"}`.trim();
  ui.notice.classList.remove("hidden");
  buildModelViewGeometry(settings, transformedInstances);
  ui.slice.disabled = !inBed;
  if (invalidateSlice) {
    sliced = null;
    ui.result.classList.add("hidden");
  }
  refreshObjectControls();
}

function showModel(file, parsed) {
  model = { ...parsed, name: file.name, byteLength: file.size };
  model.layerCommands = [];
  model.instances = [{
    name: "Objeto 1 · original",
    color: "#08d8f5",
    scalePercent: 100,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
    positionX: 0,
    positionY: 0,
    positionZ: 0
  }];
  selectedModelIndex = 0;
  nextObjectId = 2;
  ui.modelScale.value = Math.max(...parsed.size) < 1 ? "1000" : "1";
  loadSelectedInstance();
  refreshObjectControls();
  sliced = null;
  ui.modelName.textContent = file.name;
  ui.modelSize.textContent = `${formatBytes(file.size)} · ${parsed.triangles.length.toLocaleString("es")} triángulos`;
  ui.modelInfo.classList.remove("hidden");
  ui.remove.classList.remove("hidden");
  ui.uploadTitle.textContent = "Modelo cargado";
  ui.uploadHint.textContent = "Suelta otro STL aquí para reemplazarlo";
  ui.result.classList.add("hidden");
  ui.slider.value = "0";
  updateModelScale();
  ui.slider.value = ui.slider.max;
  updateViewerLayerTop();
  status("STL cargado. Ajusta la impresora y coloca el modelo en la cama.");
}

async function loadFile(file) {
  if (!file) return;
  ui.slice.disabled = true;
  status("Leyendo y comprobando el modelo…");
  try {
    const parsed = parseStl(await file.arrayBuffer());
    showModel(file, parsed);
  } catch (error) {
    status(error instanceof Error ? error.message : "No se pudo leer el archivo.", "error");
  } finally {
    ui.slice.disabled = !model;
    ui.file.value = "";
  }
}

function applyPrinterProfile() {
  const profile = PRINTER_PROFILES[ui.printerProfile.value];
  if (profile) {
    $("#printerName").value = profile.name;
    $("#bedX").value = String(profile.x);
    $("#bedY").value = String(profile.y);
    $("#bedZ").value = String(profile.z);
    ui.firmwareProfile.value = profile.firmware;
  } else {
    $("#printerName").value = "Impresora personalizada";
  }
  applyFirmwareProfile();
  if (model) updateModelScale();
}

function applyFirmwareProfile() {
  const isKlipper = ui.firmwareProfile.value === "klipper";
  $("#startGcode").value = isKlipper ? KLIPPER_START_GCODE : DEFAULT_START_GCODE;
  $("#endGcode").value = isKlipper ? KLIPPER_END_GCODE : DEFAULT_END_GCODE;
  updateExcludeObjectsControl();
  refreshLayerCommandHint();
  if (model) renderLayerCommandList();
}

function updateExcludeObjectsControl() {
  const supported = ui.firmwareProfile.value === "klipper";
  ui.excludeObjects.disabled = !supported;
  if (!supported) ui.excludeObjects.checked = false;
}

function layModel(axis) {
  ui.rotationX.value = axis === "rotationX" ? "90" : "0";
  ui.rotationY.value = axis === "rotationY" ? "90" : "0";
  ui.rotationZ.value = "0";
  updateModelScale();
}

function estimateGcodeSeconds(gcode) {
  let x = 0;
  let y = 0;
  let z = 0;
  let feedRate = 0;
  let absolute = true;
  let seconds = 0;
  for (const rawLine of gcode.split(/\r?\n/)) {
    const line = rawLine.split(";")[0].trim().toUpperCase();
    if (line === "G90") {
      absolute = true;
      continue;
    }
    if (line === "G91") {
      absolute = false;
      continue;
    }
    if (!/^(?:G0|G00|G1|G01)(?:\s|$)/.test(line)) continue;
    const values = {};
    for (const match of line.matchAll(/(?:^|\s)([XYZF])([-+]?(?:\d*\.?\d+))/g)) {
      values[match[1]] = Number(match[2]);
    }
    if (values.F > 0) feedRate = values.F;
    const nextX = values.X === undefined ? x : absolute ? values.X : x + values.X;
    const nextY = values.Y === undefined ? y : absolute ? values.Y : y + values.Y;
    const nextZ = values.Z === undefined ? z : absolute ? values.Z : z + values.Z;
    const distance = Math.hypot(nextX - x, nextY - y, nextZ - z);
    if (feedRate > 0) seconds += distance / (feedRate / 60);
    x = nextX;
    y = nextY;
    z = nextZ;
  }
  return seconds;
}

function formatEstimatedTime(seconds) {
  const totalMinutes = Math.max(1, Math.round(seconds / 60));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
}

function centerModel() {
  ui.positionX.value = "0";
  ui.positionY.value = "0";
  ui.positionZ.value = "0";
  updateModelScale();
}

function fitModelToBed() {
  const settings = readSettings(true);
  if (!model || !settings) return;
  const bounds = transformModel(settings).bounds;
  const dimensions = bounds.max.map((value, index) => value - bounds.min[index]);
  const fit = Math.min(
    1,
    settings.bedX / dimensions[0],
    settings.bedY / dimensions[1],
    settings.bedZ / dimensions[2]
  );
  ui.positionX.value = "0";
  ui.positionY.value = "0";
  ui.positionZ.value = "0";
  ui.scalePercent.value = String(Math.max(0.1, Number(ui.scalePercent.value) * fit));
  updateModelScale();
  if (fit < 1) status(`Modelo ajustado al ${(fit * 100).toFixed(1)}% de su escala actual.`);
}

function duplicateSelectedObject() {
  const settings = readSettings(true);
  if (!model || !settings) return;
  saveSelectedInstance(settings);
  if (model.instances.length >= MAX_INSTANCES ||
      model.triangles.length * (model.instances.length + 1) > MAX_TOTAL_TRIANGLES) {
    status(`No se puede duplicar: se permite un máximo de ${MAX_TOTAL_TRIANGLES.toLocaleString("es")} triángulos en total.`, "error");
    return;
  }
  const existing = transformInstances(settings);
  const source = existing[selectedModelIndex];
  const width = source.transformed.bounds.max[0] - source.transformed.bounds.min[0];
  const depth = source.transformed.bounds.max[1] - source.transformed.bounds.min[1];
  const gap = 4;
  const margin = 2;
  const stepX = width + gap;
  const stepY = depth + gap;
  let placement = null;

  for (let centerY = depth / 2 + margin; centerY <= settings.bedY - depth / 2 - margin && !placement; centerY += stepY) {
    for (let centerX = width / 2 + margin; centerX <= settings.bedX - width / 2 - margin; centerX += stepX) {
      const positionX = centerX - settings.bedX / 2;
      const positionY = centerY - settings.bedY / 2;
      const deltaX = positionX - source.instance.positionX;
      const deltaY = positionY - source.instance.positionY;
      const bounds = {
        min: [source.transformed.bounds.min[0] + deltaX, source.transformed.bounds.min[1] + deltaY, source.transformed.bounds.min[2]],
        max: [source.transformed.bounds.max[0] + deltaX, source.transformed.bounds.max[1] + deltaY, source.transformed.bounds.max[2]]
      };
      const overlaps = existing.some(({ transformed }) =>
        bounds.min[0] < transformed.bounds.max[0] + 1 &&
        bounds.max[0] > transformed.bounds.min[0] - 1 &&
        bounds.min[1] < transformed.bounds.max[1] + 1 &&
        bounds.max[1] > transformed.bounds.min[1] - 1
      );
      if (!overlaps && isModelInsideBed(bounds, settings)) {
        placement = { positionX, positionY };
        break;
      }
    }
  }

  if (!placement) {
    status("No hay espacio libre en la cama para colocar otra copia.", "error");
    return;
  }
  const copy = {
    ...source.instance,
    name: `Objeto ${nextObjectId} · copia`,
    positionX: placement.positionX,
    positionY: placement.positionY
  };
  nextObjectId += 1;
  model.instances.push(copy);
  selectedModelIndex = model.instances.length - 1;
  refreshObjectControls();
  loadSelectedInstance();
  updateModelScale();
  status("Copia colocada en un espacio libre de la cama.", "success");
}

function deleteSelectedObject() {
  if (!model || model.instances.length <= 1) return;
  model.instances.splice(selectedModelIndex, 1);
  selectedModelIndex = Math.min(selectedModelIndex, model.instances.length - 1);
  refreshObjectControls();
  loadSelectedInstance();
  updateModelScale();
  status("Copia eliminada.", "success");
}

function markSliceOutOfDate() {
  sliced = null;
  ui.result.classList.add("hidden");
  updatePrinterPrintButton();
}

function doSlice() {
  if (!model) return;
  const settings = readSettings(true);
  if (!settings) return;
  saveSelectedInstance(settings);
  const transformedInstances = transformInstances(settings);
  if (transformedInstances.some(({ transformed }) => !isModelInsideBed(transformed.bounds, settings))) {
    status("Al menos un objeto queda fuera de la cama. Acomoda todos los objetos antes de laminar.", "error");
    return;
  }
  const bounds = combineBounds(transformedInstances);
  const triangles = transformedInstances.flatMap(({ transformed }) => transformed.triangles);
  const modelHeight = bounds.max[2] - bounds.min[2];
  const layerCount = Math.ceil(modelHeight / settings.layerHeight);
  if (!Number.isFinite(layerCount) || layerCount < 1 || layerCount > 12000) {
    status("El perfil produciría una cantidad de capas no admitida (máximo: 12.000).", "error");
    return;
  }
  ui.slice.disabled = true;
  status(`Laminando ${layerCount.toLocaleString("es")} capas…`);
  window.setTimeout(() => {
    try {
      const generated = makeGcode(triangles, settings, layerCount, transformedInstances);
      const hasOpenSections = generated.contoursByLayer.some((loops) => loops.length === 0);
      sliced = { ...generated, settings };
      updatePrinterPrintButton();
      ui.slider.value = ui.slider.max;
      ui.resultLayers.textContent = layerCount.toLocaleString("es");
      ui.resultTime.textContent = formatEstimatedTime(estimateGcodeSeconds(generated.text));
      ui.resultFilament.textContent = `${(generated.filamentMm / 1000).toFixed(2)} m`;
      ui.resultSize.textContent = formatBytes(new Blob([generated.text]).size);
      ui.preview.textContent = generated.text.split("\n").slice(0, 35).join("\n");
      ui.result.classList.remove("hidden");
      updateViewerLayerTop(settings, bounds);
      status(
        hasOpenSections
          ? "Laminado generado, pero algunas capas no cerraron correctamente. Comprueba la vista por capas y el archivo antes de imprimir."
          : "Laminado generado. Revisa el G-code y confirma la compatibilidad con tu impresora antes de imprimir.",
        hasOpenSections ? "" : "success"
      );
    } catch (error) {
      status(error instanceof Error ? `No se pudo laminar: ${error.message}` : "No se pudo laminar el modelo.", "error");
    } finally {
      ui.slice.disabled = false;
    }
  }, 30);
}

function downloadGcode() {
  if (!sliced) return;
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = URL.createObjectURL(new Blob([sliced.text], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  const safeName = model.name.replace(/\.stl$/i, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 100);
  link.href = currentObjectUrl;
  link.download = `${safeName || "modelo"}.gcode`;
  document.body.append(link);
  link.click();
  link.remove();
  status("Descarga iniciada.", "success");
}

ui.file.addEventListener("change", () => loadFile(ui.file.files[0]));
ui.laminatorTab.addEventListener("click", () => showAppView("laminator"));
ui.printerTab.addEventListener("click", () => showAppView("printer"));
ui.savedPrinterForm.addEventListener("submit", savePrinterConfiguration);
ui.toggleSavedPrinters.addEventListener("click", () => {
  setSavedPrintersCollapsed(ui.toggleSavedPrinters.getAttribute("aria-expanded") === "true");
});
ui.cancelSavedPrinterEdit.addEventListener("click", cancelPrinterEdit);
ui.savedPrintersList.addEventListener("click", handleSavedPrinterAction);
ui.printToPrinter.addEventListener("click", uploadAndPrint);
ui.dropZone.addEventListener("dragover", (event) => {
  event.preventDefault();
  ui.dropZone.classList.add("dragging");
});
ui.dropZone.addEventListener("dragleave", () => ui.dropZone.classList.remove("dragging"));
ui.dropZone.addEventListener("drop", (event) => {
  event.preventDefault();
  ui.dropZone.classList.remove("dragging");
  loadFile(event.dataTransfer.files[0]);
});
ui.remove.addEventListener("click", () => {
  model = null;
  sliced = null;
  ui.layerCommandPanel.classList.add("hidden");
  setTransformMode(null);
  disposeViewerGeometry(viewerMesh);
  disposeViewerGeometry(viewerGrid);
  viewerMesh = null;
  viewerGrid = null;
  viewerBounds = null;
  ui.modelViewEmpty.classList.remove("hidden");
  ui.modelInfo.classList.add("hidden");
  ui.remove.classList.add("hidden");
  ui.uploadTitle.textContent = "Suelta aquí tu archivo STL";
  ui.uploadHint.textContent = "o toca para buscar · STL binario o ASCII";
  ui.layerControl.classList.add("hidden");
  ui.result.classList.add("hidden");
  ui.slice.disabled = true;
  ui.notice.classList.add("hidden");
  status("Carga un modelo STL para comenzar.");
});
ui.slice.addEventListener("click", doSlice);
ui.download.addEventListener("click", downloadGcode);
ui.objectSelect.addEventListener("change", () => {
  const settings = readSettings();
  saveSelectedInstance(settings);
  selectedModelIndex = Number(ui.objectSelect.value);
  loadSelectedInstance();
  updateModelScale(false);
});
ui.objectColor.addEventListener("input", () => {
  if (!model) return;
  model.instances[selectedModelIndex].color = ui.objectColor.value;
  const settings = readSettings();
  if (settings) buildModelViewGeometry(settings);
});
ui.duplicateObject.addEventListener("click", duplicateSelectedObject);
ui.deleteObject.addEventListener("click", deleteSelectedObject);
ui.modelScale.addEventListener("change", updateModelScale);
ui.scalePercent.addEventListener("change", updateModelScale);
ui.rotationX.addEventListener("change", updateModelScale);
ui.rotationY.addEventListener("change", updateModelScale);
ui.rotationZ.addEventListener("change", updateModelScale);
ui.positionX.addEventListener("change", updateModelScale);
ui.positionY.addEventListener("change", updateModelScale);
ui.positionZ.addEventListener("change", updateModelScale);
for (const input of [
  ui.modelScale, ui.scalePercent, ui.rotationX, ui.rotationY, ui.rotationZ,
  ui.positionX, ui.positionY, ui.positionZ
]) {
  input.addEventListener("input", markSliceOutOfDate);
}
ui.centerModel.addEventListener("click", centerModel);
ui.fitModel.addEventListener("click", fitModelToBed);
ui.printerProfile.addEventListener("change", applyPrinterProfile);
ui.firmwareProfile.addEventListener("change", () => {
  applyFirmwareProfile();
  markSliceOutOfDate();
});
document.querySelectorAll("[data-lay-axis]").forEach((button) => {
  button.addEventListener("click", () => layModel(button.dataset.layAxis));
});
function setTransformMode(mode) {
  if (mode && !model) {
    status("Carga primero un modelo STL para transformarlo.", "error");
    return;
  }
  transformMode = transformMode === mode ? null : mode;
  ui.moveTool.classList.toggle("active", transformMode === "move");
  ui.rotateTool.classList.toggle("active", transformMode === "rotate");
  ui.rotationAxes.classList.toggle("hidden", transformMode !== "rotate");
  ui.moveTool.setAttribute("aria-pressed", String(transformMode === "move"));
  ui.rotateTool.setAttribute("aria-pressed", String(transformMode === "rotate"));
  ui.modelCanvas.classList.toggle("transform-mode", transformMode !== null);
  ui.transformToolHint.textContent = transformMode === "move"
    ? "Mover activo: arrastra para ajustar X/Y; la altura Z no cambia."
    : transformMode === "rotate"
      ? `Girar activo: arrastra para rotar sobre el eje ${transformRotationAxis.slice(-1)}.`
      : "Elige una herramienta para transformar el modelo.";
}
ui.moveTool.addEventListener("click", () => setTransformMode("move"));
ui.rotateTool.addEventListener("click", () => setTransformMode("rotate"));
document.querySelectorAll("[data-rotation-axis]").forEach((button) => {
  button.addEventListener("click", () => {
    transformRotationAxis = button.dataset.rotationAxis;
    document.querySelectorAll("[data-rotation-axis]").forEach((axisButton) => {
      axisButton.setAttribute("aria-pressed", String(axisButton === button));
    });
    ui.transformToolHint.textContent = `Girar activo: arrastra para rotar sobre el eje ${transformRotationAxis.slice(-1)}.`;
  });
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && transformMode) setTransformMode(null);
});
$("#resetRotation").addEventListener("click", () => {
  ui.rotationX.value = "0";
  ui.rotationY.value = "0";
  ui.rotationZ.value = "0";
  updateModelScale();
});
ui.viewZoomIn.addEventListener("click", () => adjustViewerZoom(1.2));
ui.viewZoomOut.addEventListener("click", () => adjustViewerZoom(1 / 1.2));
ui.viewReset.addEventListener("click", () => {
  viewerCamera.yaw = 0.72;
  viewerCamera.pitch = 0.48;
  viewerCamera.zoom = 1;
  renderModelView();
});
ui.modelCanvas.addEventListener("wheel", (event) => {
  event.preventDefault();
  adjustViewerZoom(event.deltaY < 0 ? 1.1 : 1 / 1.1);
}, { passive: false });
let viewerPointer = null;
ui.modelCanvas.addEventListener("pointerdown", (event) => {
  const isTouchTransform = event.pointerType === "touch" && transformMode;
  const isRightButtonTransform = event.button === 2 && transformMode;
  if (isRightButtonTransform || isTouchTransform) {
    event.preventDefault();
    viewerPointer = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: "transform" };
  } else if (event.button === 0) {
    viewerPointer = { x: event.clientX, y: event.clientY, id: event.pointerId, mode: "orbit" };
  } else {
    return;
  }
  ui.modelCanvas.setPointerCapture(event.pointerId);
});
ui.modelCanvas.addEventListener("pointermove", (event) => {
  if (!viewerPointer || viewerPointer.id !== event.pointerId) return;
  const deltaX = event.clientX - viewerPointer.x;
  const deltaY = event.clientY - viewerPointer.y;
  viewerPointer.x = event.clientX;
  viewerPointer.y = event.clientY;
  if (viewerPointer.mode === "transform") {
    if (transformMode === "move") {
      const movedX = Math.max(-1000, Math.min(1000, Number(ui.positionX.value) + deltaX * 0.25));
      const movedY = Math.max(-1000, Math.min(1000, Number(ui.positionY.value) - deltaY * 0.25));
      ui.positionX.value = (Math.round(movedX * 10) / 10).toFixed(1);
      ui.positionY.value = (Math.round(movedY * 10) / 10).toFixed(1);
    } else if (transformMode === "rotate") {
      const rotationInput = $(`#${transformRotationAxis}`);
      const change = (deltaX - deltaY) * 0.5;
      const nextRotation = Math.max(-360, Math.min(360, Number(rotationInput.value) + change));
      rotationInput.value = (Math.round(nextRotation * 2) / 2).toFixed(1);
    }
    updateModelScale();
    return;
  }
  viewerCamera.yaw += deltaX * 0.01;
  viewerCamera.pitch = Math.min(1.45, Math.max(-1.35, viewerCamera.pitch + deltaY * 0.01));
  renderModelView();
});
ui.modelCanvas.addEventListener("pointerup", () => { viewerPointer = null; });
ui.modelCanvas.addEventListener("pointercancel", () => { viewerPointer = null; });
ui.modelCanvas.addEventListener("contextmenu", (event) => {
  if (transformMode) event.preventDefault();
});
ui.slider.addEventListener("input", () => {
  updateViewerLayerTop();
});
ui.slider.addEventListener("click", (event) => {
  if (!event.shiftKey || !model) return;
  event.preventDefault();
  const bounds = ui.slider.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width));
  const layer = Math.round(ratio * Number(ui.slider.max));
  ui.slider.value = String(layer);
  updateViewerLayerTop();
  openLayerCommandEditor(layer + 1);
});
ui.layerCommandMode.addEventListener("change", refreshLayerCommandHint);
ui.layerCommandText.addEventListener("input", () => {
  if (model && model.layerCommands.some((entry) => entry.layer === editingLayer)) markSliceOutOfDate();
});
ui.saveLayerCommand.addEventListener("click", saveLayerChangeCommand);
ui.removeLayerCommand.addEventListener("click", removeLayerChangeCommand);
ui.closeLayerCommand.addEventListener("click", () => ui.layerCommandPanel.classList.add("hidden"));
ui.form.addEventListener("input", () => {
  markSliceOutOfDate();
  ui.slice.disabled = !model;
});
ui.form.addEventListener("change", (event) => {
  if (event.target === ui.printerProfile) return;
  if (event.target.id === "bedX" || event.target.id === "bedY" || event.target.id === "bedZ") {
    ui.printerProfile.value = "custom";
    $("#printerName").value = "Impresora personalizada";
  }
  if (model) updateModelScale();
});
window.addEventListener("resize", () => {
  renderModelView();
});
applyPrinterProfile();
ui.savedPrinterName.value = $("#printerName").value;
try {
  loadSavedPrinters();
  const previouslyConnectedUrl = localStorage.getItem("compilar-stl-printer-url");
  if (previouslyConnectedUrl) ui.printerAddress.value = normalizePrinterUrl(previouslyConnectedUrl).href;
} catch (error) {
  console.error("No se pudieron cargar las impresoras guardadas.", error);
  setPrinterStatus(error instanceof Error ? error.message : "No se pudieron cargar las impresoras guardadas.", true);
}
try {
  initializeModelViewer();
} catch (error) {
  console.error("No se pudo inicializar la vista 3D.", error);
  ui.modelViewEmpty.textContent = "No se pudo iniciar la vista 3D en este navegador.";
}
if ("serviceWorker" in navigator && location.protocol !== "file:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch((error) => {
      console.error("No se pudo habilitar el modo sin conexión.", error);
    });
  });
}

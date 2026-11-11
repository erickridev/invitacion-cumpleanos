const { test } = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../../frontend/app.js"), "utf8");
const codigo = "11111111-1111-4111-8111-111111111111";
function page({ fail = false, estado = "pendiente" } = {}) {
    const elements = new Map();
    const element = () => ({ value: "", hidden: true, disabled: true, textContent: "", className: "", listeners: {},
        addEventListener(event, fn) { this.listeners[event] = fn; }, setAttribute() {}, querySelector() { return null; },
        replaceChildren() {}, appendChild() {}, focus() {} });
    const get = id => { if (!elements.has(id)) elements.set(id, element()); return elements.get(id); };
    const calls = []; let replaced;
    const context = {
        document: { getElementById: get, createElement: element, addEventListener: (event, fn) => { if (event === "DOMContentLoaded") fn(); } },
        location: { hash: "#codigo=" + codigo, pathname: "/", search: "" },
        history: { replaceState: (...args) => { replaced = args[2]; } },
        URLSearchParams, console, setInterval() {}, setTimeout, clearTimeout,
        fetch: async (url, options) => {
            calls.push({ url, body: JSON.parse(options.body) });
            if (url === "/api/invitacion") return { ok: !fail, json: async () => fail ? { mensaje: "Código inválido" } : { familia_id: 7, nombre_familia: "Familia de prueba", estado_asistencia: estado } };
            return { ok: true, json: async () => ({ mensaje: "Respuesta guardada", estado: JSON.parse(options.body).estado }) };
        }
    };
    vm.runInNewContext(source, context);
    return { get, calls, replaced };
}
test("un enlace privado selecciona la familia y envía su código al confirmar", async () => {
    const p = page(); await new Promise(setImmediate);
    assert.equal(p.replaced, "/");
    assert.equal(p.get("nombreFamilia").value, "Familia de prueba");
    assert.equal(p.get("btnConfirmar").disabled, false);
    p.get("respuestaAsistencia").value = "confirmado";
    await p.get("formAsistencia").listeners.submit({ preventDefault() {} });
    assert.deepEqual(p.calls[1], { url: "/api/asistencia", body: { familiaId: 7, codigo, estado: "confirmado" } });
    assert.equal(p.get("btnConfirmar").disabled, false);
    assert.equal(p.get("codigoInvitacion").disabled, false);
});
test("un enlace inválido muestra el error y permite corregir el formulario", async () => {
    const p = page({ fail: true }); await new Promise(setImmediate);
    assert.equal(p.get("mensaje").textContent, "Código inválido");
    assert.equal(p.get("nombreFamilia").disabled, false);
    assert.equal(p.get("btnConfirmar").disabled, true);
});

test("envía una negativa y permite actualizarla posteriormente", async () => {
    const p = page({ estado: "confirmado" }); await new Promise(setImmediate);
    assert.equal(p.get("respuestaAsistencia").value, "confirmado");
    assert.equal(p.get("btnConfirmar").disabled, false);
    p.get("respuestaAsistencia").value = "no_asistira";
    await p.get("formAsistencia").listeners.submit({ preventDefault() {} });
    assert.equal(p.calls[1].body.estado, "no_asistira");
    assert.equal(p.get("btnConfirmar").disabled, false);
    assert.equal(p.get("respuestaAsistencia").disabled, false);
});
test("no envía el formulario sin elegir respuesta", async () => {
    const p = page(); await new Promise(setImmediate);
    await p.get("formAsistencia").listeners.submit({ preventDefault() {} });
    assert.equal(p.calls.length, 1);
    assert.match(p.get("mensaje").textContent, /asistirá o no asistirá/);
});

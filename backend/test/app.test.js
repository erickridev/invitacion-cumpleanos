const { test } = require("node:test");
const assert = require("node:assert/strict");
const session = require("express-session");
const { createApp } = require("../app");
const { loadConfig } = require("../config");
const rateLimit = require("../middleware/rate-limit");
const codigo = "11111111-1111-4111-8111-111111111111";
const config = { sessionSecret: "a".repeat(48), adminPassword: "clave-de-prueba", production: false, proxyHops: 0 };

async function fixture(t, estado = "pendiente", fail = false) {
    const calls = [];
    const familia = { id: 1, familia_id: 1, nombre_familia: "Familia de prueba", estado_asistencia: estado, token_invitacion: codigo };
    const conn = {
        beginTransaction: async () => calls.push("begin"),
        execute: async (sql, params) => {
            if (sql.startsWith("UPDATE")) { calls.push("update"); assert.equal(sql, "UPDATE familias SET estado_asistencia = ? WHERE id = ?"); assert.ok(["confirmado", "no_asistira"].includes(params[0])); assert.equal(params[1], 1); if (fail) throw Error("fallo simulado"); return [{}]; }
            return [[familia]];
        },
        commit: async () => calls.push("commit"), rollback: async () => calls.push("rollback"), release: () => calls.push("release")
    };
    const pool = { getConnection: async () => conn, query: async () => [[familia]], execute: async () => [[{ familia_id: 1, nombre_familia: familia.nombre_familia, estado_asistencia: estado }]] };
    const app = createApp({ pool, config, store: new session.MemoryStore() });
    const server = app.listen(0, "127.0.0.1");
    await new Promise(resolve => server.once("listening", resolve));
    t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
    const base = "http://127.0.0.1:" + server.address().port;
    const request = (path, body, cookie) => fetch(base + path, { method: body === undefined ? "GET" : "POST", headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    return { request, calls, base };
}
test("rechaza confirmaciones sin código antes de consultar MySQL", async t => {
    const { request, calls } = await fixture(t);
    assert.equal((await request("/api/asistencia", { familiaId: 1 })).status, 400);
    assert.deepEqual(calls, []);
});
test("un código ajeno no modifica la familia y libera la conexión", async t => {
    const { request, calls } = await fixture(t);
    assert.equal((await request("/api/asistencia", { familiaId: 1, codigo: "2".repeat(36), estado: "confirmado" })).status, 403);
    assert.deepEqual(calls, ["begin", "rollback", "release"]);
});
test("confirma con código válido dentro de una transacción", async t => {
    const { request, calls } = await fixture(t);
    const res = await request("/api/asistencia", { familiaId: 1, codigo, estado: "confirmado" });
    assert.equal(res.status, 200); assert.equal((await res.json()).yaRegistrada, false);
    assert.deepEqual(calls, ["begin", "update", "commit", "release"]);
});
test("una confirmación repetida no vuelve a actualizar", async t => {
    const { request, calls } = await fixture(t, "confirmado");
    assert.equal((await (await request("/api/asistencia", { familiaId: 1, codigo, estado: "confirmado" })).json()).yaRegistrada, true);
    assert.deepEqual(calls, ["begin", "commit", "release"]);
});
test("revierte y libera la conexión si falla la escritura", async t => {
    const { request, calls } = await fixture(t, "pendiente", true);
    assert.equal((await request("/api/asistencia", { familiaId: 1, codigo, estado: "confirmado" })).status, 500);
    assert.deepEqual(calls, ["begin", "update", "rollback", "release"]);
});
test("el panel requiere sesión y logout invalida la cookie", async t => {
    const { request } = await fixture(t);
    assert.equal((await request("/api/admin/familias")).status, 401);
    const login = await request("/api/admin/login", { password: config.adminPassword });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];
    assert.equal((await request("/api/admin/familias", undefined, cookie)).status, 200);
    assert.equal((await request("/api/admin/logout", {}, cookie)).status, 200);
    assert.equal((await request("/api/admin/sesion", undefined, cookie)).status, 401);
});
test("limita el sexto intento de acceso", async t => {
    const { request } = await fixture(t);
    for (let i = 0; i < 5; i++) assert.equal((await request("/api/admin/login", { password: "incorrecta" })).status, 401);
    const res = await request("/api/admin/login", { password: "incorrecta" });
    assert.equal(res.status, 429); assert.ok(Number(res.headers.get("retry-after")) > 0);
});
test("el límite se restablece cuando vence la ventana", () => {
    let now = 0; let passed = 0; let status;
    const limit = rateLimit({ limit: 1, windowMs: 1000, now: () => now });
    const res = { set() {}, status(n) { status = n; return this; }, json() {} };
    limit({ ip: "prueba" }, res, () => passed++);
    limit({ ip: "prueba" }, res, () => passed++);
    assert.equal(status, 429); now = 1001;
    limit({ ip: "prueba" }, res, () => passed++); assert.equal(passed, 2);
});
test("la búsqueda pública no devuelve tokens privados", async t => {
    const { request } = await fixture(t);
    const res = await request("/api/familias/buscar?q=Familia");
    assert.equal(res.status, 200); assert.equal((await res.text()).includes("token_invitacion"), false);
});
test("JSON incorrecto devuelve 400 y las rutas desconocidas 404", async t => {
    const { request, base } = await fixture(t);
    const res = await fetch(base + "/api/asistencia", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" });
    assert.equal(res.status, 400);
    assert.equal((await request("/api/desconocida")).status, 404);
});
test("rechaza una clave de sesión débil", () => {
    assert.throws(() => loadConfig({ SESSION_SECRET: "corta", ADMIN_PASSWORD: "prueba" }), /SESSION_SECRET/);
});

test("registra que una familia no asistirá", async t => {
    const { request, calls } = await fixture(t);
    const res = await request("/api/asistencia", { familiaId: 1, codigo, estado: "no_asistira" });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.estado, "no_asistira"); assert.match(body.mensaje, /no podrá asistir/);
    assert.deepEqual(calls, ["begin", "update", "commit", "release"]);
});
test("permite cambiar una respuesta de sí a no y de no a sí", async t => {
    for (const [previo, siguiente] of [["confirmado", "no_asistira"], ["no_asistira", "confirmado"]]) {
        const { request, calls } = await fixture(t, previo);
        const res = await request("/api/asistencia", { familiaId: 1, codigo, estado: siguiente });
        assert.equal(res.status, 200); assert.equal((await res.json()).estado, siguiente);
        assert.deepEqual(calls, ["begin", "update", "commit", "release"]);
    }
});
test("repetir una negativa no vuelve a escribir", async t => {
    const { request, calls } = await fixture(t, "no_asistira");
    const res = await request("/api/asistencia", { familiaId: 1, codigo, estado: "no_asistira" });
    assert.equal(res.status, 200); assert.equal((await res.json()).yaRegistrada, true);
    assert.deepEqual(calls, ["begin", "commit", "release"]);
});
test("rechaza respuestas ausentes o inválidas sin consultar la base", async t => {
    const { request, calls } = await fixture(t);
    for (const estado of [undefined, "pendiente", "otro", true, null]) {
        assert.equal((await request("/api/asistencia", { familiaId: 1, codigo, estado })).status, 400);
    }
    assert.deepEqual(calls, []);
});

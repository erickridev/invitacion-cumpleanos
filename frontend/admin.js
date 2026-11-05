const login = document.getElementById("login");
const dashboard = document.getElementById("dashboard");
const mensaje = document.getElementById("mensaje");
const mensajeLogin = document.getElementById("mensajeLogin");

// Función para comunicarse con el servidor.
async function api(url, options = {}) {
    let response;

    try {
        response = await fetch(url, {
            ...options,
            credentials: "same-origin",
            headers: {
                "Content-Type": "application/json",
                ...options.headers
            }
        });
    } catch (error) {
        console.error("Error de conexión:", error);

        throw new Error(
            "No se pudo conectar con el servidor. Comprueba que Node.js esté ejecutándose."
        );
    }

    const texto = await response.text();
    let data;

    try {
        data = texto ? JSON.parse(texto) : {};
    } catch (error) {
        console.error("Respuesta del servidor:", texto);

        throw new Error(
            `El servidor respondió con HTTP ${response.status}, pero no devolvió JSON.`
        );
    }

    if (!response.ok) {
        throw new Error(
            data.mensaje ||
            `Error en la solicitud (HTTP ${response.status}).`
        );
    }

    return data;
}

// Mostrar la fecha de registro.
function mostrarFecha(fecha) {
    if (!fecha) {
        return "No disponible";
    }

    const fechaTexto = String(fecha);

    const fechaNormalizada = fechaTexto.includes("T")
        ? fechaTexto
        : fechaTexto.replace(" ", "T");

    const fechaConvertida = new Date(fechaNormalizada);

    if (Number.isNaN(fechaConvertida.getTime())) {
        return fechaTexto;
    }

    return fechaConvertida.toLocaleString("es-SV", {
        timeZone: "America/El_Salvador",
        dateStyle: "short",
        timeStyle: "short"
    });
}

// Crear una tarjeta de estadística.
function crearEstadistica(titulo, valor) {
    const tarjeta = document.createElement("p");
    tarjeta.className = "estadistica";

    const nombre = document.createElement("strong");
    nombre.textContent = titulo;

    const numero = document.createElement("span");
    numero.textContent = String(valor ?? 0);

    tarjeta.append(nombre, numero);

    return tarjeta;
}

// Cargar estadísticas y familias desde MySQL mediante el servidor.
async function cargarPanel() {
    mensaje.textContent = "Cargando datos...";
    mensaje.className = "";

    try {
        const [resumen, familias] = await Promise.all([
            api("/api/admin/resumen"),
            api("/api/admin/familias")
        ]);

        if (!Array.isArray(familias)) {
            throw new Error(
                "La ruta /api/admin/familias no devolvió una lista válida."
            );
        }

        // Mostrar estadísticas.
        const estadisticas =
            document.getElementById("estadisticas");

        estadisticas.replaceChildren();

        const datosEstadisticas = [
            [
                "Familias registradas",
                resumen.total_familias
            ],
            [
                "Asistirán",
                resumen.confirmados
            ],
            [
                "No asistirán",
                resumen.no_asistiran
            ],
            [
                "Pendientes",
                resumen.pendientes
            ]
        ];

        datosEstadisticas.forEach(([titulo, valor]) => {
            estadisticas.appendChild(
                crearEstadistica(titulo, valor)
            );
        });

        // Mostrar lista de familias.
        const tabla = document.getElementById("tablaInvitados");
        tabla.replaceChildren();

        if (familias.length === 0) {
            const fila = document.createElement("tr");
            const celda = document.createElement("td");

            celda.colSpan = 4;
            celda.textContent =
                "Todavía no hay familias registradas.";

            fila.appendChild(celda);
            tabla.appendChild(fila);
        } else {
            familias.forEach(familia => {
                const fila = document.createElement("tr");

                const celdaFamilia =
                    document.createElement("td");

                celdaFamilia.textContent =
                    familia.nombre_familia || "Sin nombre";

                const celdaEstado =
                    document.createElement("td");

                const estadoOriginal =
                    familia.estado_asistencia ||
                    familia.estado ||
                    "pendiente";

                const etiquetasEstado = {
                    confirmado: "Confirmada",
                    no_asistira: "No asistirá",
                    pendiente: "Pendiente"
                };

                celdaEstado.textContent =
                    etiquetasEstado[estadoOriginal] ||
                    estadoOriginal;

                const celdaFecha =
                    document.createElement("td");

                celdaFecha.textContent = mostrarFecha(
                    familia.fecha_creacion
                );

                const celdaInvitacion = document.createElement("td");
                const codigo = String(familia.token_invitacion || "");
                if (codigo) {
                    const enlace = new URL("/", location.origin);
                    enlace.hash = new URLSearchParams({ codigo }).toString();
                    const abrir = document.createElement("a");
                    abrir.href = enlace.href;
                    abrir.textContent = "Abrir invitación";
                    abrir.target = "_blank";
                    abrir.rel = "noopener noreferrer";
                    const copiar = document.createElement("button");
                    copiar.type = "button";
                    copiar.textContent = "Copiar enlace";
                    copiar.addEventListener("click", async () => {
                        try {
                            await navigator.clipboard.writeText(enlace.href);
                            mensaje.textContent = "Enlace privado copiado. Compártelo solo con esta familia.";
                            mensaje.className = "exito";
                        } catch {
                            mensaje.textContent = "No se pudo copiar. Puedes copiar la dirección de «Abrir invitación».";
                            mensaje.className = "error";
                        }
                    });
                    celdaInvitacion.append(abrir, document.createElement("br"), copiar);
                } else {
                    celdaInvitacion.textContent = "Sin código asignado";
                }

                fila.append(
                    celdaFamilia,
                    celdaEstado,
                    celdaFecha,
                    celdaInvitacion
                );

                tabla.appendChild(fila);
            });
        }

        login.hidden = true;
        dashboard.hidden = false;

        mensaje.textContent =
            "Datos actualizados correctamente.";

        mensaje.className = "exito";
        mensajeLogin.textContent = "";

    } catch (error) {
        console.error("Error al cargar el panel:", error);

        mensaje.textContent =
            "Error al cargar los datos: " + error.message;

        mensaje.className = "error";

        throw error;
    }
}

// Iniciar sesión.
document.getElementById("formLogin")
    .addEventListener("submit", async event => {
        event.preventDefault();

        const boton =
            document.getElementById("btnEntrar");

        const password =
            document.getElementById("password").value;

        boton.disabled = true;

        mensajeLogin.textContent =
            "Verificando contraseña...";

        mensajeLogin.className = "";

        try {
            await api("/api/admin/login", {
                method: "POST",
                body: JSON.stringify({ password })
            });

            mensajeLogin.textContent =
                "Acceso correcto. Cargando panel...";

            mensajeLogin.className = "exito";

            await cargarPanel();

        } catch (error) {
            console.error(
                "Error al iniciar sesión:",
                error
            );

            mensajeLogin.textContent =
                "Error: " + error.message;

            mensajeLogin.className = "error";

        } finally {
            boton.disabled = false;
        }
    });

// Actualizar la información.
document.getElementById("btnActualizar")
    .addEventListener("click", async () => {
        const boton =
            document.getElementById("btnActualizar");

        boton.disabled = true;

        try {
            await cargarPanel();
        } catch (error) {
            console.error(error);
        } finally {
            boton.disabled = false;
        }
    });

// Cerrar sesión.
document.getElementById("btnSalir")
    .addEventListener("click", async () => {
        const boton =
            document.getElementById("btnSalir");

        boton.disabled = true;

        mensaje.textContent = "Cerrando sesión...";
        mensaje.className = "";

        try {
            await api("/api/admin/logout", {
                method: "POST"
            });

            dashboard.hidden = true;
            login.hidden = false;

            document.getElementById("password").value = "";

            mensajeLogin.textContent =
                "Sesión cerrada correctamente.";

            mensajeLogin.className = "exito";
            mensaje.textContent = "";

        } catch (error) {
            console.error(
                "Error al cerrar sesión:",
                error
            );

            mensaje.textContent =
                "Error al cerrar sesión: " + error.message;

            mensaje.className = "error";

        } finally {
            boton.disabled = false;
        }
    });

// Comprobar si existe una sesión activa.
(async function comprobarSesion() {
    try {
        const sesion = await api("/api/admin/sesion");

        if (
            sesion &&
            (
                sesion.autenticado === true ||
                sesion.autorizado === true
            )
        ) {
            try {
                await cargarPanel();
            } catch (error) {
                console.error(error);
            }
        }
    } catch (error) {
        // No hay sesión activa; se puede iniciar sesión manualmente.
    }
})();

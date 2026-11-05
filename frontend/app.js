document.addEventListener("DOMContentLoaded", () => {
    const formulario = document.getElementById("formAsistencia");
    const campoFamilia = document.getElementById("nombreFamilia");
    const campoFamiliaId = document.getElementById("familiaId");
    const listaFamilias = document.getElementById("listaFamilias");
    const familiaSeleccionada = document.getElementById("familiaSeleccionada");
    const botonConfirmar = document.getElementById("btnConfirmar");
    const mensaje = document.getElementById("mensaje");
    const campoCodigo = document.getElementById("codigoInvitacion");

    if (!formulario || !campoFamilia || !campoFamiliaId || !listaFamilias ||
        !familiaSeleccionada || !botonConfirmar || !mensaje || !campoCodigo) {
        console.error("Faltan elementos del formulario en index.html.");
        return;
    }

    let temporizadorBusqueda = null;
    let numeroBusqueda = 0;
    let familiaElegida = null;
    let enviando = false;

    // 23 de enero de 2027, 4:00 p. m. en El Salvador (UTC-06:00).
    const fechaEvento = new Date("2027-01-23T16:00:00-06:00").getTime();
    const diasEl = document.getElementById("dias");
    const horasEl = document.getElementById("horas");
    const minutosEl = document.getElementById("minutos");
    const segundosEl = document.getElementById("segundos");
    const cuentaRegresiva = document.getElementById("cuentaRegresiva");

    function actualizarCuentaRegresiva() {
        if (!diasEl || !horasEl || !minutosEl || !segundosEl) return;
        const diferencia = fechaEvento - Date.now();

        if (diferencia <= 0) {
            diasEl.textContent = "000";
            horasEl.textContent = "00";
            minutosEl.textContent = "00";
            segundosEl.textContent = "00";
            const titulo = cuentaRegresiva?.querySelector("h2");
            if (titulo) titulo.textContent = "¡Llegó el gran día!";
            return;
        }

        diasEl.textContent = String(Math.floor(diferencia / 86400000)).padStart(3, "0");
        horasEl.textContent = String(Math.floor(diferencia / 3600000) % 24).padStart(2, "0");
        minutosEl.textContent = String(Math.floor(diferencia / 60000) % 60).padStart(2, "0");
        segundosEl.textContent = String(Math.floor(diferencia / 1000) % 60).padStart(2, "0");
    }
    actualizarCuentaRegresiva();
    setInterval(actualizarCuentaRegresiva, 1000);

    function mostrarMensaje(texto, tipo = "info") {
        mensaje.textContent = texto;
        mensaje.className = tipo;
        mensaje.setAttribute("role", tipo === "error" ? "alert" : "status");
    }
    function cerrarLista() {
        listaFamilias.hidden = true;
        campoFamilia.setAttribute("aria-expanded", "false");
    }
    function abrirLista() {
        listaFamilias.hidden = false;
        campoFamilia.setAttribute("aria-expanded", "true");
    }
    function limpiarSeleccion() {
        familiaElegida = null;
        campoFamiliaId.value = "";
        familiaSeleccionada.hidden = true;
        familiaSeleccionada.textContent = "";
        botonConfirmar.disabled = true;
    }

    async function buscarFamilias(texto) {
        const idBusqueda = ++numeroBusqueda;
        listaFamilias.replaceChildren();

        if (texto.length < 2) {
            cerrarLista();
            return;
        }

        const cargando = document.createElement("p");
        cargando.className = "sin-resultados";
        cargando.textContent = "Buscando familias...";
        listaFamilias.appendChild(cargando);
        abrirLista();

        try {
            const respuesta = await fetch(
                `/api/familias/buscar?q=${encodeURIComponent(texto)}`,
                { headers: { Accept: "application/json" } }
            );
            const datos = await respuesta.json();

            if (idBusqueda !== numeroBusqueda) return;
            if (!respuesta.ok) throw new Error(datos.mensaje || "No se pudieron buscar las familias.");
            if (!Array.isArray(datos)) throw new Error("Respuesta inválida del servidor.");

            listaFamilias.replaceChildren();
            if (!datos.length) {
                const aviso = document.createElement("p");
                aviso.className = "sin-resultados";
                aviso.textContent = "No encontramos esa familia. Revisa el nombre o contacta a la persona organizadora.";
                listaFamilias.appendChild(aviso);
                abrirLista();
                return;
            }

            datos.forEach(familia => {
                const opcion = document.createElement("button");
                opcion.type = "button";
                opcion.className = "opcion-familia";
                opcion.setAttribute("role", "option");
                opcion.textContent = familia.nombre_familia;
                opcion.addEventListener("click", () => seleccionarFamilia(familia));
                listaFamilias.appendChild(opcion);
            });
            abrirLista();
        } catch (error) {
            if (idBusqueda !== numeroBusqueda) return;
            console.error("Error al buscar familias:", error);
            listaFamilias.replaceChildren();
            const aviso = document.createElement("p");
            aviso.className = "sin-resultados";
            aviso.textContent = "No se pudo cargar la lista. Comprueba la conexión e inténtalo de nuevo.";
            listaFamilias.appendChild(aviso);
            abrirLista();
        }
    }

    function seleccionarFamilia(familia) {
        numeroBusqueda++;
        clearTimeout(temporizadorBusqueda);
        if (!familia || !Number.isSafeInteger(Number(familia.familia_id)) ||
            !familia.nombre_familia) {
            mostrarMensaje("La familia seleccionada no es válida.", "error");
            limpiarSeleccion();
            return;
        }

        familiaElegida = {
            id: Number(familia.familia_id),
            nombre: String(familia.nombre_familia),
            estado: String(familia.estado_asistencia || "pendiente")
        };
        campoFamilia.value = familiaElegida.nombre;
        campoFamiliaId.value = String(familiaElegida.id);
        familiaSeleccionada.textContent = `Familia seleccionada: ${familiaElegida.nombre}`;
        familiaSeleccionada.hidden = false;
        cerrarLista();

        if (familiaElegida.estado === "confirmado") {
            botonConfirmar.disabled = true;
            mostrarMensaje("La asistencia de esta familia ya estaba confirmada. ¡Gracias!", "exito");
        } else {
            botonConfirmar.disabled = false;
            mostrarMensaje("Familia seleccionada. Puedes confirmar su asistencia.", "info");
        }
    }

    campoFamilia.addEventListener("input", () => {
        numeroBusqueda++;
        limpiarSeleccion();
        mostrarMensaje("");
        clearTimeout(temporizadorBusqueda);
        const texto = campoFamilia.value.trim();

        if (texto.length < 2) {
            numeroBusqueda++;
            listaFamilias.replaceChildren();
            cerrarLista();
            return;
        }
        temporizadorBusqueda = setTimeout(() => buscarFamilias(texto), 250);
    });

    campoFamilia.addEventListener("focus", () => {
        const texto = campoFamilia.value.trim();
        if (texto.length >= 2 && !familiaElegida) buscarFamilias(texto);
    });

    document.addEventListener("click", event => {
        if (!event.target.closest(".buscador-familias")) cerrarLista();
    });

    formulario.addEventListener("submit", async event => {
        event.preventDefault();
        if (enviando) return;

        if (!familiaElegida || !campoFamiliaId.value) {
            mostrarMensaje("Primero busca y selecciona tu familia de la lista.", "error");
            campoFamilia.focus();
            return;
        }
        if (familiaElegida.estado === "confirmado") {
            botonConfirmar.disabled = true;
            mostrarMensaje("Esta familia ya confirmó su asistencia. ¡Gracias!", "exito");
            return;
        }

        if (campoCodigo.value.trim().length !== 36) {
            mostrarMensaje("Introduce el código privado que recibiste con tu invitación.", "error");
            campoCodigo.focus();
            return;
        }

        enviando = true;
        botonConfirmar.disabled = true;
        campoFamilia.disabled = true;
        campoCodigo.disabled = true;
        mostrarMensaje("Registrando tu confirmación...", "info");

        try {
            const respuesta = await fetch("/api/asistencia", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ familiaId: familiaElegida.id, codigo: campoCodigo.value.trim() })
            });
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(datos.mensaje || "No se pudo registrar la asistencia.");

            familiaElegida.estado = "confirmado";
            botonConfirmar.disabled = true;
            mostrarMensaje(
                datos.mensaje || "¡Confirmación exitosa! Gracias por confirmar la asistencia de su familia.",
                "exito"
            );
        } catch (error) {
            console.error("Error al confirmar asistencia:", error);
            mostrarMensaje(error.message || "Ocurrió un error. Inténtalo nuevamente.", "error");
            botonConfirmar.disabled = !familiaElegida || familiaElegida.estado === "confirmado";
        } finally {
            enviando = false;
            campoFamilia.disabled = false;
            campoCodigo.disabled = false;
        }
    });

    // El fragmento no se envía al servidor ni en la petición inicial de la página.
    const codigoEnlace = new URLSearchParams(location.hash.slice(1)).get("codigo");
    if (codigoEnlace) {
        history.replaceState(null, "", location.pathname + location.search);
        campoCodigo.value = codigoEnlace;
        campoFamilia.disabled = true;
        mostrarMensaje("Cargando tu invitación...", "info");
        fetch("/api/invitacion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ codigo: codigoEnlace })
        }).then(async respuesta => {
            const datos = await respuesta.json();
            if (!respuesta.ok) throw new Error(datos.mensaje || "No se pudo cargar la invitación.");
            seleccionarFamilia(datos);
        }).catch(error => mostrarMensaje(error.message, "error"))
            .finally(() => { campoFamilia.disabled = false; });
    }
});

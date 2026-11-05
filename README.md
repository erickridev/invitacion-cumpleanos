# Invitación de XV años de Kristel

Invitación adaptable a computadoras y celulares, con confirmación privada por familia y panel administrativo. La ceremonia está fijada al 23 de enero de 2027 a las 16:00 de El Salvador (UTC−6).

## Requisitos e instalación

- Node.js 24 LTS y npm.
- MySQL 8 con una base de datos creada en UTF-8 (utf8mb4).

Desde la raíz del proyecto:

```powershell
cd backend
npm ci
Copy-Item .env.example .env
```

Si ya tienes un archivo .env, conserva sus valores; no lo sobrescribas. Configura DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME y ADMIN_PASSWORD. Genera una clave aleatoria para SESSION_SECRET y guárdala en .env:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
npm run db:init
npm start
```

El comando db:init crea las tablas que falten y conserva las existentes. No cambia nombres, tokens ni confirmaciones. La cuenta de MySQL necesita permisos de creación para este paso; la cuenta de ejecución necesita SELECT, INSERT, UPDATE y DELETE sobre las tablas de la aplicación.

Abre [la invitación](http://localhost:3000) o [el panel administrativo](http://localhost:3000/admin.html). Usa npm run dev para reiniciar automáticamente el servidor al editar el backend. La página y la API se sirven desde Express; no abras el HTML directamente ni uses un servidor separado para el frontend.

## Familias y enlaces privados

Los tokens existentes se conservan. Para registrar una nueva familia, ejecuta en tu cliente de MySQL una inserción con un UUID aleatorio generado por Node.js:

```powershell
node -e "console.log(require('crypto').randomUUID())"
```

```sql
INSERT INTO familias (nombre_familia, token_invitacion)
VALUES ('Familia de ejemplo', 'UUID-ALEATORIO-GENERADO-PARA-ESTA-FAMILIA');
```

Reemplaza el texto de ejemplo por el UUID real de 36 caracteres y utiliza un UUID diferente por familia. En el panel, pulsa «Copiar enlace» y comparte ese enlace solo con la familia correspondiente. Abrirlo selecciona automáticamente a la familia. También se puede buscar el nombre e introducir el código manualmente.

El enlace lleva el código en el fragmento #codigo=..., que el navegador no envía al cargar la página. La aplicación lo retira de la barra de direcciones y lo verifica mediante POST. La búsqueda pública no devuelve códigos; la confirmación valida que el código corresponda al ID seleccionado. Quien tenga el enlace puede confirmar por esa familia: trátalo como privado. La búsqueda por nombre sigue siendo pública y devuelve hasta 15 coincidencias con su estado de asistencia.

Para invalidar un enlace compartido por error, asigna a esa familia un nuevo UUID desde MySQL y vuelve a copiar el enlace desde el panel. El anterior dejará de funcionar. El panel es de consulta: la carga y edición de familias se realiza desde MySQL.

## Organización

- frontend/index.html y admin.html: estructura de las páginas.
- frontend/styles.css e invitation.css: diseño de la invitación y buscador.
- frontend/app.js: cuenta regresiva, búsqueda y confirmación.
- frontend/admin.css y admin.js: panel y enlaces privados.
- backend/server.js: arranque y cierre del servidor.
- backend/app.js: middleware y montaje de rutas; permite pruebas sin abrir MySQL.
- backend/config.js y db.js: configuración validada y pool de conexiones.
- backend/routes/: autenticación, estadísticas, familias y asistencia.
- backend/middleware/: control de acceso y límites por IP.
- backend/stores/: sesiones persistentes en MySQL.
- backend/sql/schema.sql y scripts/init-db.js: inicialización sin borrar datos.
- backend/test/: pruebas de seguridad, sesiones y transacciones con datos simulados.

## Producción

Configura NODE_ENV=production y sirve la aplicación por HTTPS. Las cookies serán HttpOnly, SameSite=Lax y Secure. Si hay exactamente un proxy HTTPS de confianza delante de Node.js, configura TRUST_PROXY_HOPS=1 y restringe el acceso directo al servidor; ajusta el número a tu infraestructura. Deja 0 cuando no exista proxy.

SESSION_SECRET es obligatorio y debe tener al menos 32 caracteres aleatorios. Mantén su valor entre reinicios; cambiarlo invalida las cookies existentes. Las sesiones duran cuatro horas y se almacenan en la tabla sesiones. Las filas vencidas se limpian de forma diferida al guardar sesiones, como máximo una vez por hora.

El acceso administrativo permite cinco intentos cada 15 minutos por IP. Las rutas públicas permiten 120 solicitudes por minuto por IP. Estos límites están en memoria y se restablecen al reiniciar: para varias instancias o límites persistentes utiliza un almacén compartido o el proxy. No despliegues múltiples instancias sin adaptar este control.

Conserva .env y node_modules fuera de Git. Versiona .env.example y package-lock.json. Realiza respaldos de MySQL y no publiques los tokens ni las sesiones. No se ha configurado alojamiento ni publicado el proyecto.

## Verificación

Desde backend:

```powershell
npm test
```

Las pruebas usan datos simulados y no modifican los invitados reales. Con MySQL disponible, GET /api/salud verifica la conexión. Antes de distribuir los enlaces, prueba con una familia de prueba en una copia de la base de datos y revisa el diseño en computadora y móvil.

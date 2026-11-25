# Studate: backend

API REST de [Studate](https://studateapp.blogspot.com/), la app para conocer a gente de tu propia
universidad. Es el proyecto del Grupo 3 de EA (María Cazorla, Diego Soledispa y Miguel Ángel
Quiroga), organizado en capas (rutas, middleware, controllers, services y models).

El objetivo del Sprint 1 (el mínimo 1) es el **backoffice**: la zona de administración, en la que
solo entra un `admin`. Pide:

- Gestión de usuarios y roles, con el rol del usuario en el payload del JWT
- Tres modelos: `User`, `Grade` (los votos de La Orla) y `Date` (las citas)
- Paginación en el servidor
- Archivar (borrado lógico) y eliminar para siempre (borrado físico)
- Usuarios activos e inactivos, con un prehook de Mongoose

El proyecto parte del ejercicio del Seminario 7 (JWT, refresh token en cookie HttpOnly, paginación y
WebSockets), que se guarda tal cual en el tag `seminari7-base`. De ahí se trae la autenticación, la
estructura en capas y la forma de hacer la paginación, el borrado lógico y Swagger.

El frontend que consume esta API (la web en React y la app del móvil) está en
[STUDATE---FRONTEND](https://github.com/mariacazorla/STUDATE---FRONTEND).

Las tareas del sprint, el contrato con el frontend y la bitácora están en [LOGS.md](LOGS.md); cómo
trabajamos (ramas, commits, pull requests), en [CONTRIBUTING.md](CONTRIBUTING.md). El tablero del
sprint es el [GitHub Project de Studate](https://github.com/users/mariacazorla/projects/2).

## Stack tecnológico

Lo que ya está instalado y funcionando:

| Tecnología | Versión | Para qué se usa |
|---|---|---|
| [Node.js](https://nodejs.org/) | 24 LTS (mínimo 22.12) | Ejecuta JavaScript fuera del navegador: es el servidor |
| [TypeScript](https://www.typescriptlang.org/) | 6.0 | JavaScript con tipos. Se compila a JavaScript en `build/` |
| [Express](https://expressjs.com/) | 5.2 | Recibe las peticiones HTTP y las reparte por rutas y middleware |
| [MongoDB](https://www.mongodb.com/) | local o Atlas | Base de datos que guarda documentos |
| [Mongoose](https://mongoosejs.com/) | 9.10 | Define la forma de los datos (esquemas) y habla con MongoDB |
| [Joi](https://joi.dev/) | 18.2 | Comprueba que el body de una petición es correcto |
| [dotenv](https://github.com/motdotla/dotenv) | 17.4 | Carga las variables del archivo `.env` en `process.env` |
| [chalk](https://github.com/chalk/chalk) | 4.1 | Pone colores a los mensajes de la consola |
| [cors](https://github.com/expressjs/cors) | 2.8 | Controla desde qué origen puede llamar un navegador a la API |
| [swagger-ui-express](https://github.com/scottie1984/swagger-ui-express) | 5.0 | Muestra la documentación de la API en `/api-docs` |
| [swagger-jsdoc](https://github.com/Surnet/swagger-jsdoc) | 6.3 | Construye esa documentación leyendo los comentarios `@openapi` de las rutas |
| [joi-to-swagger](https://github.com/Twipped/joi-to-swagger) | 6.2 | Convierte los esquemas de Joi en los esquemas de la documentación |
| [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) | 9.0 | Firma y verifica los tokens JWT (`sign` y `verify`) |
| [socket.io](https://socket.io/) | 4.8 | El chat de los Dates en tiempo real (WebSockets), en el mismo puerto que la API |
| [tsx](https://tsx.is/) | 4.23 | Ejecuta TypeScript sin compilar y reinicia la API al guardar (`npm run dev`) |
| [Oxlint](https://oxc.rs/docs/guide/usage/linter) | 1.85 | Analiza el código de `src/` y detecta errores comunes |
| [Prettier](https://prettier.io/) | extensión de VS Code | Da formato al código al guardar (reglas en `.prettierrc`) |

Las contraseñas no necesitan librería: se cifran con `scrypt`, que viene con Node (`node:crypto`).

## Requisitos previos

- [Node.js](https://nodejs.org/) 24 LTS (mínimo 22.12). Incluye [npm](https://www.npmjs.com/).
  Si usas [nvm](https://github.com/nvm-sh/nvm), `nvm use` elige la versión indicada en `.nvmrc`.
- [MongoDB](https://www.mongodb.com/): una instancia local o un cluster en MongoDB Atlas.
- [VS Code](https://code.visualstudio.com/) con la extensión Prettier (recomendado).

TypeScript no hace falta instalarlo aparte: viene con las dependencias del proyecto.

## Clonar el proyecto

```
git clone https://github.com/mariacazorla/STUDUDATE---BACKEND.git
cd STUDUDATE---BACKEND
```

## Instalar las dependencias

```
npm install
```

## Configurar las variables de entorno

Cada miembro del equipo tiene su propio `.env`, que **no se sube a git**. Se crea copiando la plantilla:

```
cp .env.example .env
```

| Variable | Qué es | Valor por defecto |
|---|---|---|
| `MONGO_URL` | Dirección de tu MongoDB | `mongodb://127.0.0.1:27017/studate` |
| `SERVER_PORT` | Puerto en el que escucha la API | `1337` |
| `CORS_ORIGINS` | Orígenes exactos de los frontends, separados por comas (con cookies no vale `*`) | `http://localhost:5173,http://localhost:8081` |
| `NODE_ENV` | Con `production`, la cookie del refresh token se marca `Secure` (solo HTTPS) | `development` |
| `REFRESH_COOKIE_PATH` | Ruta de la cookie del refresh token. Detrás de nginx (`/api`) es `/api/auth` | `/auth` |
| `COOKIE_SECURE` | Opcional: fuerza si la cookie es `Secure` (`true` o `false`) | lo que diga `NODE_ENV` |
| `JWT_SECRET` | Secreto con el que se firma el access token. **Obligatoria** | valor de clase en `.env.example` |
| `JWT_REFRESH_SECRET` | Secreto con el que se firma el refresh token; distinto del anterior. **Obligatoria** | valor de clase en `.env.example` |
| `JWT_EXPIRES_IN` | Cuánto dura el access token | `15m` (15 minutos) |
| `JWT_REFRESH_EXPIRES_IN` | Cuánto dura el refresh token | `7d` (7 días) |

Si falta `JWT_SECRET` o `JWT_REFRESH_SECRET`, la API no arranca y dice qué variable falta. Si ya tenías
un `.env` de antes de la autenticación, copia esas cuatro líneas de `.env.example`.

Studate usa su propia base de datos (`studate`), así los datos de los seminarios no se mezclan con los
del proyecto.

## Llenar la base de datos (la primera vez)

Si arrancas con la base de datos vacía, la API funciona pero no devuelve nada y no hay ningún usuario
con el que iniciar sesión. Para tener datos con los que probar, hay 14 usuarios, 25 votos de La Orla
y 4 Dates de ejemplo en `src/seed-data.ts` (los Dates salen de las cuatro parejas que se han dado A+): un admin, un usuario normal y doce estudiantes con su perfil. De los estudiantes,
dos están inactivos y dos archivados, para poder probar el prehook de activos y el borrado lógico:

```
npm run seed
```

Este comando solo inserta los datos si la base de datos está vacía. Si ya tienes datos de pruebas
anteriores, o vienen de una versión antigua de los modelos (por ejemplo, los usuarios de antes de tener
perfil), hay que borrarlos y volver a crearlos:

```
npm run seed -- --reset
```

Siempre trabaja sobre la base de datos de tu `.env`.

Todos tienen la contraseña `studate26`. Los que más se usan para probar:

| Email | Rol | Para qué |
|---|---|---|
| `admin@example.com` | `admin` | Entrar en el backoffice |
| `user@example.com` | `user` | Un usuario normal: puede iniciar sesión, pero no entrar en el backoffice |
| `aina@example.com`, `iker@example.com` | `user` | Inactivos |
| `sara@example.com`, `dani@example.com` | `user` | Archivados |

Las contraseñas están escritas a la vista en `src/seed-data.ts`. Es un proyecto de clase: son públicas
a propósito, para que cualquiera que clone el repositorio pueda entrar con cualquier usuario. En la
base de datos sí se guardan cifradas, porque el modelo `User` las cifra antes de guardarlas.


## Estructura del proyecto

```
src/
  server.ts        Punto de entrada: conecta con MongoDB, registra el middleware y las rutas y arranca el servidor
  seed.ts          Script que llena la base de datos con los datos de ejemplo
  seed-data.ts     Los datos de ejemplo
  config/          Lee las variables de entorno y las reúne en un objeto config
    swagger.ts       Las piezas comunes de la documentación de Swagger
  library/         Utilidades compartidas
    Logging.ts       Mensajes de consola con fecha y color (info, warning, error)
  routes/          El mapa de URLs: qué petición va a qué controller
    Auth.ts, Users.ts, Grade.ts, Orla.ts, Date.ts, Plan.ts, Block.ts, Report.ts, SafetyAlert.ts
  sockets/         El chat en tiempo real con socket.io
    Chat.ts          Arranca socket.io sobre el servidor HTTP: una sala por Date, turno de palabra y mensajes
    events.ts        El contrato de eventos del chat (los mismos tipos que tiene el frontend en packages/shared)
  jobs/            Tareas periódicas del servidor
    ExpireDates.ts   Cierra cada minuto los Dates pendientes que han caducado
  middleware/      Lo que se ejecuta entre la ruta y el controller
    VerifyToken.ts   Comprueba el token de la cabecera Authorization y deja el usuario en req.user (401).
                     Aquí se amplía también el tipo Request de Express con req.user
    SocketAuth.ts    Lo mismo para el chat: comprueba el token del handshake de socket.io y deja el usuario en socket.data.user
    RequireRole.ts   Deja pasar solo a un rol concreto (403)
    Joi.ts           Guardas: validan el body (422), el id de la URL (400) y la paginación (400)
    Cors.ts          Cabeceras de CORS, configuradas con CORS_ORIGINS
    Logger.ts        Escribe en consola cada petición y su código de respuesta
    ErrorHandler.ts  Convierte cualquier error en su código: 400, 401, 404, 409, 422 o 500
  controllers/     Leen la petición (req), llaman al service y eligen la respuesta (res)
    Auth.ts, Users.ts, Grade.ts, Orla.ts, Date.ts, Plan.ts, Block.ts, Report.ts, SafetyAlert.ts
  services/        Leen y escriben en la base de datos a través de los models. No saben que existe HTTP (ni socket.io)
    AuthService.ts, UserService.ts, GradeService.ts, OrlaService.ts, DateService.ts, PlanService.ts, ChatService.ts,
    BlockService.ts, ReportService.ts, SafetyAlertService.ts
  models/          Esquemas de Mongoose y las interfaces de cada recurso
    User.ts          Usuario, y las interfaces de los tokens (payload) y de req.user
    Grade.ts         Voto de La Orla (A+ o F de un usuario a otro)
    Date.ts          Date (cita entre dos usuarios) con su historial; se importa como DateModel
    Plan.ts          Plan (el Cambio de Aula de un Date) con las tiradas de la ruleta
    Message.ts       Mensaje del chat de un Date
    Block.ts         Bloqueo de un usuario a otro
    Report.ts        Parte sobre un usuario, que revisa un admin
    SafetyAlert.ts   Alerta del botón de ayuda
  utils/           Funciones pequeñas sin dependencias de Express
    password.ts      Cifra y comprueba contraseñas con scrypt
    escape-regexp.ts Escapa el texto de una búsqueda para usarlo en una expresión regular
```

Una petición recorre las capas siempre en el mismo orden:

```
cliente -> server.ts (logger, JSON, CORS) -> routes/ -> middleware/ (token, rol y validación) -> controllers/ -> services/ -> models/ -> MongoDB
```

Cada capa hace una sola cosa. Por eso los `services/` y los `models/` no importan Express:
si un día se cambiara Express por otro framework, esas dos carpetas no habría que tocarlas.

## Autenticación

La API usa **JWT** (JSON Web Token). Un JWT es un texto con tres partes separadas por puntos:
cabecera, contenido (payload) y firma. El servidor firma el token con un secreto que solo él conoce
(`JWT_SECRET`), así que puede comprobar que un token lo ha creado él y que nadie lo ha modificado.
El contenido **no está cifrado**: cualquiera puede leerlo (por ejemplo en https://jwt.io). Por eso
solo lleva el id del usuario (`sub`), su rol (`role`) y cuándo caduca (`exp`), nunca la contraseña.

El recorrido completo:

1. `POST /auth/register` con `{ name, email, password }` crea el usuario (siempre con el rol `user`)
   y responde 201 **sin token**. El frontend lleva entonces a la página de login.
2. `POST /auth/login` con `{ email, password }` responde `{ token, user }`, o 401 si el email o la
   contraseña no son correctos (el mismo mensaje en los dos casos, para no revelar qué emails están
   registrados). El refresh token no va en el JSON: se deja en una **cookie HttpOnly** (ver más abajo).
   La app del móvil es la excepción: manda la cabecera `X-Client: movil` y lo recibe en el JSON.
3. En cada petición a una ruta protegida, el cliente envía el token en la cabecera:
   `Authorization: Bearer <token>`.
4. El middleware `VerifyToken` comprueba la firma y la caducidad, y que el usuario siga activo, y deja el
   usuario en `req.user`. Si falta el token, ha caducado, no es válido o la cuenta ya no está activa,
   responde 401.
5. El middleware `RequireRole('admin')` comprueba el rol: si el usuario no es `admin`, responde 403.
6. El access token dura poco (15 minutos). Cuando caduca, el cliente llama a `POST /auth/refresh`
   sin body: el navegador adjunta la cookie y la API responde `{ token }`, un access token nuevo, sin
   volver a escribir la contraseña. El refresh token dura 7 días. La app del móvil hace la misma
   llamada con `{ refreshToken }` en el body.
7. `POST /auth/logout` borra la cookie. A partir de ahí, `/auth/refresh` responde 401.

### Dónde va cada token

El access token se devuelve en el JSON y el frontend lo guarda **solo en memoria**. El refresh token
viaja en la cookie `refreshToken`, que pone el backend con `res.cookie` en el login:

| Atributo | Para qué |
|---|---|
| `HttpOnly` | JavaScript no puede leerla (`document.cookie` no la muestra). Un script inyectado por XSS no se la puede llevar |
| `SameSite=Strict` | El navegador no la envía en peticiones que provoca otra web (CSRF) |
| `Path=/auth` | Solo se envía a `/auth/refresh` y `/auth/logout`, que son las únicas rutas que la necesitan. Se cambia con `REFRESH_COOKIE_PATH` (detrás de nginx, `/api/auth`) |
| `Max-Age` | Dura lo mismo que el refresh token (`JWT_REFRESH_EXPIRES_IN`) |
| `Secure` | Solo por HTTPS. Se activa con `NODE_ENV=production` (o con `COOKIE_SECURE`); en clase va por `http://localhost` |

Para que el navegador envíe y acepte la cookie entre `localhost:5173` y `localhost:1337`, el frontend
llama a la API con `credentials: 'include'` y CORS responde con `credentials: true` y el origen de la
petición, si está en la lista de `CORS_ORIGINS` (con credenciales, `*` no está permitido). La cookie la
lee `cookie-parser`, que la deja en `req.cookies`.

La app del móvil no es un navegador: no tiene cookies HttpOnly ni pasa por CORS. Por eso tiene su
propio modo, que no cambia nada de lo anterior:

| | Web | App del móvil |
|---|---|---|
| Login | Sin cabeceras especiales | Cabecera `X-Client: movil` |
| Dónde llega el refresh token | Cookie HttpOnly; no aparece en el JSON | En el JSON (`refreshToken`); no se pone cookie |
| Dónde se guarda | Lo guarda el navegador; JavaScript no lo ve | En el almacén cifrado del teléfono (`expo-secure-store`) |
| `POST /auth/refresh` | Sin body: viaja la cookie | Body `{ refreshToken }` |

Si a `/auth/refresh` le llegan la cookie y el body, se usa el del body: es el que el cliente ha
enviado a propósito.

401 y 403 no son lo mismo: 401 es "no sé quién eres" (no hay sesión válida) y 403 es "sé quién eres,
pero no tienes permiso".

Qué está protegido. Cada ruta lleva sus middlewares en su router (`src/routes/`), en este orden:
primero `VerifyToken`, después `RequireRole` si hace falta un rol, después la validación y por último
el controller. Por ejemplo:

```ts
router.get('/me', VerifyToken, controller.readMe);
```

La autenticación va antes que la validación: a quien no tiene sesión se le responde 401, sin decirle
si su petición estaba bien formada.

| Rutas | Quién puede |
|---|---|
| `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Cualquiera (refresh necesita un refresh token válido, en la cookie o en el body) |
| `/ping`, `/api-docs` | Cualquiera |
| `/users/me`, `/users/directory` | Cualquier usuario con sesión |
| `/users`, `/users/:userId`, `/users/:userId/archive`, `/users/:userId/restore` (gestión de usuarios) | Solo `admin` |
| `/grades` (votos de La Orla) | Solo `admin` |
| `/orla` (La Orla del estudiante) | Solo `user` |
| `/dates`, `/dates/:dateId`, `/dates/:dateId/messages`, `/dates/:dateId/extend` | Cualquier usuario con sesión, cada uno sus propios Dates; el admin, todos |
| `POST /dates`, `PUT /dates/:dateId`, `DELETE /dates/:dateId` | Solo `admin`: los estudiantes no abren ni cambian Dates a mano |
| El chat (socket.io) | Cualquier usuario con sesión, solo en las salas de sus propios Dates. Los `admin` entran además en la sala `admins` y reciben las alertas de ayuda |
| `/blocks` (bloqueos) | Solo `user` |
| `POST /reports` (mandar un parte), `POST /alerts` (pedir ayuda) | Solo `user` |
| `GET /reports`, `PUT /reports/:reportId/review`, `GET /alerts`, `PUT /alerts/:alertId/attend` | Solo `admin` |

Decisiones y límites, porque es un proyecto de clase:

- El access token y el refresh token se firman con **secretos distintos**: un refresh token no sirve
  como access token, ni al revés.
- Los refresh tokens **no se guardan** en la base de datos. Es lo más sencillo, pero tiene un coste:
  el servidor no puede invalidar un refresh token antes de que caduque, y cerrar sesión consiste en
  borrar la cookie (`/auth/logout`) y que el frontend olvide el access token que tiene en memoria.
- Al renovar, el servidor vuelve a leer el usuario de la base de datos: si le han cambiado el rol, el
  token nuevo ya lleva el rol actual; si se ha borrado, desactivado o archivado, responde 401.

### Usuarios activos (prehook)

Un admin puede desactivar a un usuario (`active: false`) o archivarlo (`deleted: true`). Ninguno de los dos
tiene que poder entrar. En lugar de filtrar en cada consulta, el modelo `User` tiene un **prehook de
Mongoose**: una función que se ejecuta antes de cada consulta de usuarios y le añade el filtro
`{ active: true, deleted: false }`:

```ts
UserSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function () {
    if (this.getOptions().withInactive) {
        return;
    }

    this.where({ active: true, deleted: false });
});
```

Como el login busca al usuario por email, a un usuario inactivo o archivado no lo encuentra y responde 401
con el mismo mensaje de siempre. Lo mismo al renovar el token. Las rutas del admin sí necesitan verlos
a todos, y se saltan el filtro con `.setOptions({ withInactive: true })`.

¿Y si el usuario ya tenía sesión cuando lo desactivan? Su access token sigue siendo válido hasta 15
minutos. Para que no pueda seguir usando la API, `VerifyToken` busca en cada petición al usuario del token
(pasando por el prehook) y, si ya no está activo, responde 401 "Tu cuenta no está activa". El frontend,
con cualquier 401 que no sea de token caducado, cierra la sesión y lleva al login. Cuesta una consulta a
MongoDB por petición, que para este proyecto no es un problema.

Para probarlo con curl:

```
curl -c cookies.txt -X POST http://localhost:1337/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"studate26"}'
curl http://localhost:1337/users/me -H "Authorization: Bearer <el token de la respuesta anterior>"
curl -b cookies.txt -X POST http://localhost:1337/auth/refresh
```

`-c` guarda la cookie que deja el login y `-b` la envía en el refresh. Sin `-b`, el refresh responde 401.

## Endpoints

Todas las rutas salvo `/auth/*` y `/ping` necesitan la cabecera `Authorization: Bearer <token>` (ver
[Autenticación](#autenticación)).

| Método | URL | Qué hace | Body |
|---|---|---|---|
| GET | `/ping` | Comprueba que la API está viva | |
| POST | `/auth/register` | Registra un usuario (rol `user`). No devuelve token | `{ "name": "...", "email": "...", "password": "..." }` |
| POST | `/auth/login` | Inicia sesión: devuelve `{ token, user }` y deja el refresh token en una cookie HttpOnly | `{ "email": "...", "password": "..." }` |
| POST | `/auth/refresh` | Devuelve un access token nuevo: `{ token }`. Lee el refresh token de la cookie | |
| POST | `/auth/logout` | Borra la cookie del refresh token (204) | |
| GET | `/users/me` | Devuelve el usuario con sesión (`_id`, `name`, `email`, `role`). Lo saca de `req.user` | |
| GET | `/users/directory` | Con quién puede abrir un Date el usuario con sesión: los demás usuarios activos (nombre, titulación y foto). Cualquier usuario con sesión | |
| GET | `/users` | Lista los usuarios, paginados (`?page=&limit=&search=&role=&active=&degree=&archived=`). Solo admin | |
| GET | `/users/:userId` | Devuelve un usuario, también si está inactivo o archivado. Solo admin | |
| POST | `/users` | Crea un usuario con su rol y si está activo. Solo admin | `{ "name": "...", "email": "...", "password": "...", "role": "user" }` |
| PUT | `/users/:userId` | Edita un usuario, su rol y si está activo (no la contraseña). Solo admin | `{ "name": "...", "email": "...", "role": "user", "active": true }` |
| POST | `/users/:userId/archive` | Archiva un usuario (borrado lógico). Solo admin | |
| POST | `/users/:userId/restore` | Restaura un usuario archivado. Solo admin | |
| DELETE | `/users/:userId` | Elimina para siempre un usuario archivado (borrado físico) y sus votos. Solo admin | |
| GET | `/grades` | Lista los votos de La Orla, paginados (`?page=&limit=&value=&user=`). Solo admin | |
| GET | `/grades/:gradeId` | Devuelve un voto, con los datos de los dos usuarios. Solo admin | |
| POST | `/grades` | Crea un voto. Solo admin | `{ "from": "<id>", "to": "<id>", "value": "A+" }` |
| PUT | `/grades/:gradeId` | Cambia la nota de un voto. Solo admin | `{ "value": "F" }` |
| DELETE | `/grades/:gradeId` | Elimina un voto (borrado físico). Solo admin | |
| GET | `/dates` | Lista los Dates, paginados (`?page=&limit=&status=&user=`). El admin ve todos; un usuario, los suyos | |
| GET | `/dates/:dateId` | Devuelve un Date (un usuario, solo los suyos) | |
| GET | `/dates/:dateId/messages` | El historial del chat de un Date, paginado (`?page=&limit=`; la página 1 son los más nuevos). Solo los dos del Date y el admin | |
| POST | `/dates` | Abre un Date a mano entre dos usuarios. Solo admin | `{ "users": ["<id>", "<id>"] }` |
| PUT | `/dates/:dateId` | Cambia el Date de bandeja a mano; queda en el historial. Solo admin | `{ "status": "closed", "reason": "..." }` |
| POST | `/dates/:dateId/extend` | Usa la prórroga: 24 horas más, una sola vez (y no en un Date cerrado) | |
| DELETE | `/dates/:dateId` | Elimina un Date (borrado físico). Solo admin | |
| GET | `/blocks` | A quién he bloqueado | |
| POST | `/blocks` | Bloquear a alguien: cierra el Date que tuviéramos y ninguno vuelve a ver al otro | `{ "blocked": "<id>" }` |
| DELETE | `/blocks/:userId` | Quitar un bloqueo mío (el Date no se reabre) | |
| POST | `/reports` | Mandar un parte sobre alguien (queda abierto para el admin) | `{ "reported": "<id>", "reason": "harassment", "date": "<id>", "text": "..." }` |
| GET | `/reports` | Lista los partes, paginados (`?page=&limit=&status=&severity=&reported=`). Solo admin | |
| GET | `/reports/:reportId` | Devuelve un parte. Solo admin | |
| PUT | `/reports/:reportId/review` | Revisa un parte: gravedad y lo que se ha hecho; queda quién y cuándo. Solo admin | `{ "status": "reviewed", "severity": "high", "resolution": "..." }` |
| POST | `/alerts` | Pedir ayuda: avisa al momento a los admin y a los contactos de confianza (si hay) | `{ "date": "<id>", "message": "..." }` (todo opcional) |
| GET | `/alerts` | Lista las alertas, paginadas (`?page=&limit=&status=`). Solo admin | |
| GET | `/alerts/:alertId` | Devuelve una alerta. Solo admin | |
| PUT | `/alerts/:alertId/attend` | Atiende una alerta; queda quién y cuándo. Solo admin | `{ "status": "attended" }` |

Un usuario tiene `name`, `email` y `role` (`user` o `admin`), los datos de su perfil (`birthDate`,
`degree` o titulación, `lookingFor` o "Qué busco", `bio` y `photo`) y el estado de su cuenta: `active`
(si un admin lo ha desactivado) y `deleted` con `deletedAt` (si está archivado). La contraseña nunca se
devuelve. La foto se guarda dentro del propio usuario como texto en base64 (`data:image/jpeg;base64,...`),
con un máximo de 200 000 caracteres: es lo más sencillo para el proyecto y no necesita guardar ficheros.

Ejemplo con curl (también sirve Postman o Thunder Client):

```
curl http://localhost:1337/users/me -H "Authorization: Bearer <token>"
```

En el listado de usuarios, `search` busca en el nombre y el email sin distinguir mayúsculas; `role` deja
solo los de un rol; `active=true` o `active=false`, solo los activos o los inactivos; `degree`, solo los de una titulación
(el texto entero); y `archived=true`,
solo los archivados (por defecto no salen). Un admin no puede cambiarse su propio rol ni desactivarse:
responde 403 "No puedes hacer esto con tu propio usuario", para que el backoffice no se quede sin admin.

Un voto de La Orla (`Grade`) es la nota que un usuario (`from`) le pone al perfil de otro (`to`): `A+`
(aprobado, me interesa) o `F` (suspenso). En las respuestas, `from` y `to` llegan con el nombre, el email
y la foto del usuario (`populate`), también si está inactivo. Cada usuario solo puede votar una vez a
cada perfil (409 si se repite) y nadie se puede votar a sí mismo (422). `value` filtra por nota y `user`
deja los votos en los que participa un usuario. Un voto no se archiva: eliminarlo es un borrado físico.

Un **Date** es una cita entre dos usuarios (`users`). Se abre solo cuando los dos se ponen A+ en La Orla
(al crear un voto A+ o al cambiar uno a A+, si ya existe el A+ contrario); el admin también puede abrirlo a
mano. Al abrirse se sortea a quién le toca escribir primero (`firstTurn`) y caduca en 24 horas (`expiresAt`);
la prórroga (`POST /dates/:dateId/extend`) añade 24 horas más una sola vez (`extended`). Está en una de las
bandejas del blog (`status`): `pending` (Pendiente), `ongoing` (En curso) o `closed` (Cerrado). Solo puede
haber un Date entre cada pareja (409). Un usuario normal solo ve sus propios Dates; los de otros le dan 404.
Al eliminar un usuario para siempre se borran también sus Dates.

Los estudiantes **no cambian los Dates de estado a mano**: los estados cambian solos y cada cambio queda en
el `history` del Date (`[{ status, by?, reason?, at }]`, del más antiguo al más nuevo):

- Nace `pending` (sin `by`: lo abre el servidor por el A+ mutuo; con el `by` del admin si lo abre él).
- El **primer mensaje** del chat lo pasa a `ongoing` (`startedAt` es la hora de ese mensaje, `by` quien lo escribió).
- Si **caduca sin mensajes**, el servidor lo cierra (`closed`, `closedReason: 'expired'`, sin `by`): una tarea
  lo comprueba cada minuto (`src/jobs/ExpireDates.ts`). Un Date en curso no caduca.
- La **prórroga** no cambia el estado, pero también se apunta (`reason: 'Prórroga de 24 horas'`, `by` quien la pidió).
- El **admin** puede cambiarlo a mano desde el backoffice (`PUT /dates/:dateId`) con un `reason` opcional; al
  cerrar, `closedReason` es `'admin'`.

El modelo se llama `Date` en MongoDB, pero en el código se importa como `DateModel`: `Date` ya es la clase de
fechas de JavaScript, y si el modelo se llamara así, `new Date()` dejaría de funcionar en ese fichero.

## Chat en tiempo real (socket.io)

El chat de cada Date va por **socket.io**, enganchado al mismo servidor HTTP que Express (mismo puerto; en el
servidor, nginx reenvía `/socket.io/` al contenedor de la API). Los mensajes se guardan en MongoDB (modelo
`Message`) y el historial se lee por HTTP (`GET /dates/:dateId/messages`); el socket es para lo que pasa
**ahora**.

**Sin token no se conecta nadie.** El cliente manda el access token en el handshake y el middleware
`VerifySocketToken` (`src/middleware/SocketAuth.ts`) lo comprueba igual que `VerifyToken`: firma, caducidad y
que el usuario siga activo. Si falla, el cliente recibe `connect_error` con el mismo mensaje que daría la API
(`Falta el token`, `El token ha caducado`, `Token no válido`, `Tu cuenta no está activa`) y no entra en ninguna
sala. El token solo se comprueba al conectar: una conversación abierta no se corta cuando el token caduca a
los 15 minutos.

```ts
const socket = io('http://localhost:1337', { auth: { token } });
```

Cada Date es una **sala** (`date:<id>`) en la que solo entran sus dos usuarios: quien escribe sale siempre del
token, nunca del payload. Los eventos (`src/sockets/events.ts`):

| Quién | Evento | Payload | Qué hace |
|---|---|---|---|
| cliente | `date:join` | `{ dateId }` | Entrar en la sala. Un tercero recibe `chat:error` (el Date "no existe" para él) |
| cliente | `date:leave` | `{ dateId }` | Salir de la sala |
| cliente | `date:message` | `{ dateId, text }` | Enviar un mensaje (1 a 1000 caracteres, el mismo Joi que una ruta). Hay que haber entrado antes |
| cliente | `date:read` | `{ dateId }` | He leído los mensajes de la otra persona (`readAt`) |
| servidor | `date:joined` | `{ dateId }` | Ya estás en la sala |
| servidor | `date:message` | el mensaje guardado | A los dos de la sala, también a quien lo escribió (con su `_id` y `createdAt`) |
| servidor | `date:updated` | el Date entero | El Date ha cambiado: primer mensaje (En curso), caducidad (Cerrado), prórroga o un cambio del admin |
| servidor | `date:read` | `{ dateId, by, at }` | La otra persona ha leído |
| servidor | `chat:error` | `{ message }` | Algo no se ha podido hacer |

Las reglas del chat (`src/services/ChatService.ts`): en un Date `pending` solo puede escribir quien tiene el
primer turno (`firstTurn`, sorteado al abrirlo); el primer mensaje lo pasa a `ongoing` y a partir de ahí
escriben los dos; en un Date `closed` se puede entrar a leer, pero no escribir.

Los `admin` entran además, al conectar, en la sala `admins`, por la que les llegan al momento las alertas del
botón de ayuda: `alert:new` (alguien ha pedido ayuda) y `alert:updated` (un admin la ha atendido). Un estudiante
nunca recibe esos eventos: el rol sale del token.

## Seguridad: bloquear, partes y botón de ayuda

Son las tres funciones de "conciencia digital" del blog, cada una con su modelo y sus rutas:

- **Bloquear** (`/blocks`, modelo `Block`): si alguien te da mala espina, lo bloqueas y ninguno de los dos vuelve
  a ver al otro: ni en La Orla (no sale y no se puede votar) ni en los chats (el Date que tuvierais se cierra con
  `closedReason: 'blocked'`, y la otra persona ve el chat cerrado sin que se le diga por qué). A la persona
  bloqueada no se le avisa. Desbloquear no reabre el Date.
- **Partes** (`/reports`, modelo `Report`): un estudiante manda un parte sobre alguien (motivo, comentario y, si
  es desde un chat, el Date). Solo lo ve el admin, que lo revisa poniendo la gravedad y anotando lo que ha hecho;
  queda guardado qué admin lo revisó y cuándo. De momento no hay nada automático.
- **Botón de ayuda** (`/alerts`, modelo `SafetyAlert`): durante un Date, el estudiante pide ayuda (todo opcional:
  un mensaje y desde qué Date). Se crea la alerta, los admin conectados la reciben al momento por el socket y se
  avisa a los contactos de confianza de Mi perfil, si los tiene (el aviso se simula en el log del servidor, como el
  email de bienvenida). Sin contactos, la alerta se crea igual. Atenderla deja quién y cuándo.

Códigos de respuesta: 201 al crear, 200 al leer o modificar, 204 al borrar, 400 si el id de la URL
no tiene forma de id de MongoDB, 401 si falta el token o no es válido, 403 si el usuario no tiene el
rol necesario, 404 si el id no existe, 409 si el email ya existe, 422 si el body no es
válido y 500 si falla algo en el servidor.

## Borrado lógico y borrado físico

Hay dos formas de "borrar" un usuario, y en el backoffice se usan en este orden:

1. **Archivar** (borrado lógico, *soft delete*): `POST /users/:userId/archive`. El usuario **no se elimina**
   de MongoDB: se marca con `deleted: true` y la fecha en `deletedAt`. A partir de ahí:
   - no sale en el listado (sí con `?archived=true`);
   - no puede iniciar sesión ni renovar el token (lo hace el [prehook](#usuarios-activos-prehook));
   - no se puede editar (404) hasta que se restaure;
   - su email sigue ocupado, así que al restaurarlo nunca choca con otro usuario.
2. **Restaurar**: `POST /users/:userId/restore` deshace el archivado (`deleted: false` y se quita `deletedAt`).
3. **Eliminar para siempre** (borrado físico, *hard delete*): `DELETE /users/:userId`. El documento
   desaparece de MongoDB y no se puede deshacer. Solo se puede con un usuario **archivado**; si no, la API
   responde 409 "Archiva el usuario antes de eliminarlo".

¿Por qué en dos pasos? El borrado lógico es lo normal en una aplicación real: un error se arregla
restaurando y no se pierden datos. El borrado físico existe para cuando de verdad hay que quitar los datos
de alguien (por ejemplo, si lo pide el propio usuario), y obligar a archivar antes evita borrar a alguien
por error con un solo clic.

Un admin no puede archivarse ni eliminarse a sí mismo (403).

## Documentación de la API

La documentación de cada endpoint se escribe en un comentario `/** @openapi */` justo encima de su
ruta, en `src/routes/`. Al arrancar, `swagger-jsdoc` lee esos comentarios y monta el documento que
se ve en http://localhost:1337/api-docs.

Los esquemas del body no se escriben a mano: `joi-to-swagger` los genera a partir de los mismos
esquemas de Joi que validan las peticiones, así que la documentación no puede quedarse desfasada
cuando se añade o se quita un campo.

Las piezas comunes (datos generales, esquemas, respuestas de error y el esquema de seguridad
`bearerAuth`) están en `src/config/swagger.ts`. Cada respuesta de error lleva de ejemplo el mensaje que
devuelve de verdad la API (por ejemplo, `NotArchived`, `OwnUser`, `GradeConflict` o `DateConflict`), para
que quien hace el frontend sepa qué va a recibir. Las rutas están agrupadas por etiquetas: Health, Auth,
Users, Grades, Orla, Dates, Plans, Blocks, Reports y Alerts. Los eventos del chat no son rutas HTTP y no salen en Swagger: están en la
tabla de [Chat en tiempo real](#chat-en-tiempo-real-socketio) y en `src/sockets/events.ts`. En `src/routes/Auth.ts` la documentación va debajo
del código, para que el router se lea de un vistazo.

Para probar las rutas protegidas desde Swagger: ejecuta `POST /auth/login`, copia el `token` de la
respuesta, pulsa el botón **Authorize** de arriba a la derecha y pégalo (solo el token, sin la palabra
`Bearer`). A partir de ahí Swagger envía la cabecera en todas las peticiones. Las rutas con candado son
las que lo necesitan.

## Cómo se ha probado la API

No hay tests automáticos en el backend. Al cerrar cada rama se prueba lo hecho contra la API arrancada y
con la base de datos recién sembrada (`npm run seed -- --reset`), con curl (o `fetch`, y `socket.io-client`
para el chat), también los casos de error: sin
token, con el rol que no toca, con ids que no existen o mal formados, con el body mal y con las reglas de
cada recurso (archivar antes de eliminar, un voto por pareja, una prórroga por Date...). Cada entrada de la
bitácora de [LOGS.md](LOGS.md) dice qué se probó y cuántas pruebas salieron bien. Un ejemplo:

```
curl -c cookies.txt -X POST http://localhost:1337/auth/login -H "Content-Type: application/json" -d '{"email":"admin@example.com","password":"studate26"}'
curl "http://localhost:1337/users?archived=true" -H "Authorization: Bearer <token>"
curl -X DELETE http://localhost:1337/users/<id de un usuario no archivado> -H "Authorization: Bearer <token>"
```

La última responde 409 "Archiva el usuario antes de eliminarlo". Las mismas pruebas se pueden hacer desde
la página de Swagger.

## Docker

La imagen de la API se construye con el `Dockerfile` de la raíz, en dos etapas como en el Seminario 10:
la primera compila el TypeScript y la segunda se queda solo con lo compilado (`build/`) y las dependencias
de producción. No lleva el código fuente, ni TypeScript, ni ningún `.env`.

```
docker build -t studate-api .
docker run --rm -p 1337:1337 --env-file .env studate-api
```

**La imagen es la misma en todos los entornos.** Lo que cambia son las variables de entorno que recibe el
contenedor al arrancar (las de la tabla de arriba). En el servidor, la API va detrás de nginx en `/api`, así
que ahí se pone `REFRESH_COOKIE_PATH=/api/auth`, y `COOKIE_SECURE` según haya HTTPS o no.

A diferencia del Seminario 10, el seed va dentro de la imagen, compilado (`build/seed.js`), para poder
llenar la base de datos del servidor sin tener el código allí:

```
docker run --rm --env-file .env studate-api node build/seed.js
```

Con `MONGO_URL` apuntando al MongoDB de ese entorno (en el compose, `mongodb://mongodb:27017/studate`).
Solo inserta si la base de datos está vacía; con `--reset` la rehace.

El `docker compose` que levanta MongoDB, la API y la web está en el repositorio
[STUDATE---DOCKER](https://github.com/mariacazorla/STUDATE---DOCKER).

## Cómo contribuir

Ramas, commits y pull requests en [CONTRIBUTING.md](CONTRIBUTING.md). Tareas pendientes y bitácora en
[LOGS.md](LOGS.md).

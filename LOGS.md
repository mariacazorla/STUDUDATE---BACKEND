# LOGS

Bitácora del backend de Studate. Tiene dos partes:

- **Tareas**: lo que hay que hacer en este repositorio en el sprint, agrupado por ramas. Quien cierra una tarea la marca.
- **Bitácora**: lo que se ha hecho, las decisiones tomadas y qué prompts de IA se han usado.

Las tareas del frontend están en el LOGS.md de [STUDATE---FRONTEND](https://github.com/mariacazorla/STUDATE---FRONTEND).
El tablero del sprint, con las horas, es el [GitHub Project de Studate](https://github.com/users/mariacazorla/projects/2).

## Contrato

Lo que backend y frontend tienen que cumplir igual. Si algo de aquí cambia, se cambia en los dos LOGS.md.

- **Rutas públicas**: `POST /auth/register` y `POST /auth/login`. `POST /auth/refresh` y `POST /auth/logout` se autentican con el refresh token (en la cookie o, la app del móvil, en el body). `GET /ping` y la documentación
  (`/api-docs`) también son públicas. Todo lo demás exige token.
- **Registro**: el cuerpo es `{ name, email, password }` (contraseña de 8 caracteres como mínimo; `role` no se acepta, todo usuario nuevo es `user`). Responde 201 con `{ user }` y **sin token**, 409
  si el email ya existe o 422 si el cuerpo no es válido. El frontend redirige entonces a la página de login.
- **Login**: el cuerpo es `{ email, password }`. Responde `{ token, user }` o 401. `user` es `{ _id, name, email, role, createdAt, updatedAt }`, sin contraseña. El refresh token **no va en el
  JSON**: se deja en la cookie `refreshToken` (HttpOnly, SameSite=Strict, Path=/auth, Max-Age de 7 días; Secure en producción). La ruta y el Secure de la cookie se
  cambian con `REFRESH_COOKIE_PATH` (detrás de nginx, `/api/auth`) y `COOKIE_SECURE`.
- **Login desde la app del móvil**: la misma ruta con la cabecera `X-Client: movil`. Responde `{ token, refreshToken, user }` y **no pone cookie**: la app guarda el refresh
  token en el almacén cifrado del teléfono.
- **Refresh**: la web no manda cuerpo y se lee el refresh token de la cookie; la app del móvil manda `{ refreshToken }` en el cuerpo. Si llegan los dos, se usa el del
  cuerpo. Responde `{ token }` (un access token nuevo), o 401 si no hay refresh token, ha caducado o no es válido; 422 si `refreshToken` no es un texto. El refresh token no cambia.
- **Logout**: sin cuerpo. Borra la cookie y responde 204. Después, `/auth/refresh` responde 401. La app del móvil cierra sesión borrando su refresh token.
- **Cookies y CORS**: la web llama a la API con `credentials: 'include'`; el backend responde con `Access-Control-Allow-Credentials: true` y el origen de la petición si está
  en la lista de `CORS_ORIGINS` (por defecto `http://localhost:5173` y `http://localhost:8081`; no vale `*`). Las peticiones sin `Origin` (la app del móvil) no pasan por CORS.
- **Paginación**: todos los listados aceptan `page` y `limit` (de 1 a 100) y, si no se dice `limit`, devuelven **10** elementos por página.
- **Token**: se envía en la cabecera `Authorization: Bearer <token>`. Su payload lleva los claims `sub` (id del usuario), `role` y `exp`. El access token dura 15 minutos y el refresh token 7 días.
  El frontend guarda el access token solo en memoria, nunca en `localStorage` ni `sessionStorage`; al recargar la página lo recupera llamando a `/auth/refresh` y después a `/users/me`.
- **Errores de autenticación**: 401 si falta el token, ha caducado (`{ message: 'El token ha caducado' }`) o no es válido (`{ message: 'Token no válido' }`); 403 si hay sesión pero no el rol
  necesario.
- **Usuario con sesión (Mi perfil)**: `GET /users/me` (con sesión, cualquier rol) responde `{ user }` con el perfil completo a partir del token: `{ _id, name, email,
  role, birthDate?, degree?, lookingFor?, bio?, photo?, trustedContacts, active, deleted, createdAt, updatedAt }`. Es la única respuesta que incluye
  `trustedContacts` (cada uno `{ name, email, phone? }`): solo los ve su dueño. `PUT /users/me` con `{ name, birthDate?, degree?, lookingFor?, bio?, photo?,
  trustedContacts? }` responde 200 `{ user }`; `email`, `role` y `active` no se aceptan (422), así que un estudiante no puede subirse a admin.
  `trustedContacts` es opcional, admite `[]` para quitarlos y como mucho 3 (el cuarto, 422).
- **Con quién abrir un Date**: `GET /users/directory` (con sesión, cualquier rol) responde `{ users: [{ _id, name, degree?, photo? }] }`: los demás usuarios
  de rol `user` activos, ordenados por nombre.
- **Usuario**: `{ _id, name, email, role, birthDate?, degree?, lookingFor?, bio?, photo?, active, deleted, deletedAt?, createdAt, updatedAt }`, nunca con
  contraseña. `photo` es una imagen PNG o JPG en base64 (`data:image/...;base64,...`, 200 000 caracteres como mucho). Los contactos de confianza
  (`trustedContacts`: hasta 3, cada uno `{ name, email, phone? }`) son privados y **no van** en el usuario: ninguna respuesta de hoy los incluye.
- **Usuarios inactivos y archivados**: no pueden iniciar sesión ni renovar el token (401 con el mensaje de siempre). Lo hace el prehook del modelo.
  Si ya tenían sesión, cualquier petición con su token responde 401 `{ message: 'Tu cuenta no está activa' }` y el frontend cierra la sesión.
- **Gestión de usuarios** (solo `admin`):
  - `GET /users?page=&limit=&search=&role=&active=&degree=&archived=` responde `{ users, total, page, pages }`, ordenados por nombre. `search` busca en
    nombre y email; `role` es `user` o `admin`; `active` es `true` o `false`; `degree` es una titulación entera; `archived=true` lista solo los
    archivados (por defecto no salen). 400 si un filtro no es válido.
  - `GET /users/:userId` responde `{ user }`, también si está inactivo o archivado; 404 si no existe.
  - `POST /users` con `{ name, email, password, role?, active?, birthDate?, degree?, lookingFor?, bio?, photo? }` responde 201 `{ user }`; 409 si el
    email existe, 422 si el cuerpo no vale.
  - `PUT /users/:userId` con lo mismo salvo `password` (`name` y `email` obligatorios) responde 200 `{ user }`; 404 si no existe o está archivado.
    `photo: ''` quita la foto.
  - `POST /users/:userId/archive` (borrado lógico) responde 200 `{ user }` con `deleted: true`; 404 si no existe o ya estaba archivado.
  - `POST /users/:userId/restore` responde 200 `{ user }`; 404 si no existe o no estaba archivado.
  - `DELETE /users/:userId` (borrado físico) responde 204. Solo con usuarios archivados: si no, 409 `{ message: 'Archiva el usuario antes de eliminarlo' }`.
  - Un admin no puede cambiarse su propio rol, desactivarse, archivarse ni eliminarse: 403 `{ message: 'No puedes hacer esto con tu propio usuario' }`.
  - Al eliminar un usuario para siempre se borran también sus votos de La Orla, sus Dates (con el Plan y los mensajes de cada uno), sus bloqueos, sus partes y sus alertas.
- **Voto de La Orla (Grade)**: `{ _id, from, to, value, createdAt, updatedAt }`. `from` (quien vota) y `to` (a quien) llegan como
  `{ _id, name, email, photo? }`, también si el usuario está inactivo. `value` es `'A+'` o `'F'`. Un solo voto por pareja (from, to).
- **Votos de La Orla** (solo `admin`):
  - `GET /grades?page=&limit=&value=&user=` responde `{ grades, total, page, pages }`, primero los más nuevos. `user` deja los votos en los que
    ese usuario vota o es votado. 400 si un filtro no es válido.
  - `GET /grades/:gradeId` responde `{ grade }`; 404 si no existe.
  - `POST /grades` con `{ from, to, value }` responde 201 `{ grade }`; 409 si la pareja ya tiene voto (`{ message: 'Este usuario ya ha votado ese perfil' }`); 422 si `from` y `to` son el mismo usuario
    (`{ message: 'Un usuario no se puede votar a sí mismo' }`) o el cuerpo no vale; 404 si `from` o `to` no existen.
  - `PUT /grades/:gradeId` con `{ value }` responde 200 `{ grade }`. `DELETE /grades/:gradeId` responde 204 (borrado físico).
  - Si al crear un A+ o al cambiar un voto a A+ ya existe el A+ contrario, se abre un Date entre los dos (si no lo había ya).
- **Date**: `{ _id, users, status, firstTurn, expiresAt, extended, startedAt?, closedAt?, closedReason?, history, createdAt, updatedAt }`. `users` son los dos
  usuarios como `{ _id, name, email, photo? }`; `status` es `'pending'` (Pendiente), `'ongoing'` (En curso) o `'closed'` (Cerrado); `firstTurn` es el id del usuario al que
  le toca escribir primero (sorteado); `expiresAt` es 24 horas después de abrirse; `extended` dice si ya se usó la prórroga. Un solo Date por pareja.
  `startedAt` es cuándo pasó a En curso; `closedAt` y `closedReason` (`'expired'`, `'blocked'` o `'admin'`), cuándo y por qué se cerró. `history` es la lista de cambios
  de estado, `[{ status, by?, reason?, at }]`, del más antiguo al más nuevo; sin `by`, lo hizo el servidor. Todo Date nace con la entrada `pending`.
- **Dates** (cualquier usuario con sesión; el admin ve todos y un usuario normal solo los suyos):
  - `GET /dates?page=&limit=&status=&user=` responde `{ dates, total, page, pages }`, primero los más nuevos. `user` solo lo usa el admin.
  - `GET /dates/:dateId` responde `{ date }`; 404 si no existe o es de otros.
  - `POST /dates` con `{ users: [idA, idB] }` es **solo del admin** (un estudiante recibe 403: sus Dates se abren con el A+ mutuo). Responde 201 `{ date }`
    con `history: [{ status: 'pending', by: <admin>, reason: 'Abierto por un admin', at }]`; 409 si ya hay un Date entre ellos
    (`{ message: 'Ya hay un Date entre estos dos usuarios' }`); 404 si alguno no existe; 422 si no son dos ids distintos.
  - `PUT /dates/:dateId` con `{ status, reason? }` es **solo del admin** (403 si no). Responde 200 `{ date }` y añade al `history` `{ status, by: <admin>,
    reason?, at }`; al cerrar, `closedAt` es ahora y `closedReason` es `'admin'`; al reabrir se quitan los dos; a `ongoing` rellena `startedAt` si no lo
    tenía. Si el estado es el que ya tenía, no se apunta nada. 404 si no existe.
  - `POST /dates/:dateId/extend` (los dos del Date) suma 24 horas a `expiresAt`, pone `extended: true` y añade al `history` `{ status: <el que tenía>, by,
    reason: 'Prórroga de 24 horas', at }`; 409 si ya se usó (`{ message: 'La prórroga de este Date ya se ha usado' }`) o si el Date está cerrado
    (`{ message: 'Este Date está cerrado' }`). La sala del chat recibe `date:updated`.
  - `GET /dates/:dateId/messages?page=&limit=` (los dos del Date y el admin) responde `{ messages, total, page, pages }`: la página 1 son los mensajes
    **más nuevos** y dentro de cada página van en orden cronológico. 404 si el Date es de otros.
  - `DELETE /dates/:dateId` (solo admin) responde 204. Con el Date se borran su Plan y sus mensajes.
  - **Estados automáticos**: el primer mensaje del chat pasa el Date a `ongoing` (`startedAt` = hora del mensaje, `history` con `by` quien lo
    escribió y `reason: 'Primer mensaje'`). Un Date `pending` que llega a `expiresAt` lo cierra el servidor (comprobación cada minuto):
    `closed`, `closedReason: 'expired'`, `history` sin `by` y `reason: 'Caducado sin mensajes'`. Un Date `ongoing` no caduca.
- **Chat en tiempo real (socket.io)**: mismo origen y puerto que la API (en el servidor, nginx reenvía `/socket.io/`). El cliente conecta con
  `io(url, { auth: { token } })`; sin token válido, `connect_error` con el mismo mensaje que daría el 401 de la API (`Falta el token`,
  `El token ha caducado`, `Token no válido`, `Tu cuenta no está activa`). Con `El token ha caducado` el cliente renueva y reconecta; con los demás
  cierra la sesión. El token solo se comprueba al conectar. Cada Date es una sala en la que solo entran sus dos usuarios:
  - cliente → servidor: `date:join { dateId }`, `date:leave { dateId }`, `date:message { dateId, text }` (1 a 1000 caracteres; hay que haber hecho
    `date:join` antes), `date:read { dateId }`.
  - servidor → cliente: `date:joined { dateId }`; `date:message <Message>` a los dos de la sala (también a quien lo escribió, ya con `_id` y
    `createdAt`); `date:updated <Date>` cuando el Date cambia (primer mensaje, caducidad, prórroga, cambio del admin); `date:read { dateId, by, at }`;
    `chat:error { message }` (`No puedes entrar en este Date`, `Entra en el Date antes de escribir`, `Todavía no es tu turno: empieza la otra persona`,
    `Este Date está cerrado: ya no se puede escribir`, o el mensaje de Joi del texto).
  - Turno: en un Date `pending` solo escribe `firstTurn`; después del primer mensaje escriben los dos. En un Date `closed` se entra a leer, no a escribir.
- **Message**: `{ _id, date, from, text, readAt?, createdAt }`. `text` de 1 a 1000 caracteres. Llega por el socket y por `GET /dates/:dateId/messages`.
- **Bloqueos** (`/blocks`, solo rol `user`; el que bloquea sale del token. A la persona bloqueada no se le avisa y no hay ruta con la que pueda saberlo):
  - **Block**: `{ _id, blocker, blocked, createdAt }`. Un solo bloqueo por pareja (blocker, blocked).
  - `GET /blocks` responde `{ blocks }`, los míos, con `blocked` como `{ _id, name, degree?, photo? }`.
  - `POST /blocks` con `{ blocked }` responde 201 `{ block, date }`: `date` es el Date que tenían los dos y se ha cerrado (`closedReason: 'blocked'`, `history`
    con `by` quien bloqueó y `reason: 'Bloqueo'`; su sala recibe `date:updated`), o `null` si no había. 422 si es uno mismo, 404 si no existe o no es
    estudiante, 409 si ya estaba bloqueado (`{ message: 'Ya tienes bloqueada a esta persona' }`).
  - `DELETE /blocks/:userId` responde 204; 404 si no había bloqueo. El Date cerrado no se reabre.
  - Con un bloqueo en cualquiera de los dos sentidos, ninguno le sale al otro en La Orla ni puede votarlo (403), y el chat del Date está cerrado.
- **Partes** (`/reports`; mandarlo es del rol `user`, el resto solo `admin`: un estudiante que pida la lista o un parte recibe 403):
  - **Report**: `{ _id, reporter, reported, date?, reason, text?, status, severity?, resolution?, reviewedBy?, reviewedAt?, createdAt, updatedAt }`. `reporter` y
    `reported` llegan como `{ _id, name, email, photo? }`, también si están inactivos. `reason` es `'harassment'`, `'fake_profile'`, `'inappropriate'` u
    `'other'`; `status`, `'open'`, `'reviewed'` o `'dismissed'`; `severity` (`'low'`, `'medium'` o `'high'`) y `resolution` las pone el admin.
  - `POST /reports` con `{ reported, reason, date?, text? }` responde 201 `{ report }` abierto; 422 si es sobre uno mismo, si `reason` no vale o si `date` no es
    un Date mío con esa persona (`{ message: 'Ese Date no es tuyo' }`); 404 si `reported` no existe.
  - `GET /reports?page=&limit=&status=&severity=&reported=` responde `{ reports, total, page, pages }`, primero los más nuevos; 400 si un filtro no vale.
  - `GET /reports/:reportId` responde `{ report }`; 404 si no existe.
  - `PUT /reports/:reportId/review` con `{ status: 'reviewed' | 'dismissed', severity?, resolution? }` responde 200 `{ report }` con `reviewedBy` y
    `reviewedAt`; `status: 'open'` da 422. Se puede volver a revisar (se sobreescriben gravedad, resolución, quién y cuándo).
- **Botón de ayuda** (`/alerts`; pedir ayuda es del rol `user`, el resto solo `admin`):
  - **SafetyAlert**: `{ _id, user, date?, plan?, type, message?, status, attendedBy?, attendedAt?, createdAt, updatedAt }`. `user` llega como
    `{ _id, name, email, photo? }`. `type` es `'sos'`; `status`, `'open'`, `'attended'` o `'false_alarm'`.
  - `POST /alerts` con `{ date?, plan?, message? }` (todo opcional) responde 201 `{ alert, contactsNotified }`: la alerta abierta y a cuántos contactos de
    confianza se ha avisado (0 si no tiene: la alerta se crea igual y la ven los admin). 422 si `date` o `plan` no son míos. Los admin conectados reciben
    la alerta al momento por el socket (`alert:new`); el aviso a los contactos es simulado (una línea en el log del servidor por contacto, como el email
    de bienvenida).
  - `GET /alerts?page=&limit=&status=` responde `{ alerts, total, page, pages }`, primero las más nuevas; 400 si el filtro no vale.
  - `GET /alerts/:alertId` responde `{ alert }`; 404 si no existe.
  - `PUT /alerts/:alertId/attend` con `{ status: 'attended' | 'false_alarm' }` responde 200 `{ alert }` con `attendedBy` y `attendedAt`; `'open'` da 422.
    Los demás admin reciben `alert:updated`.
  - **Socket de los admin**: al conectar, un socket con rol `admin` entra solo en la sala `admins` y recibe `alert:new <SafetyAlert>` y
    `alert:updated <SafetyAlert>`. Un estudiante nunca los recibe.
- **La Orla del estudiante** (`/orla`, solo rol `user`; el `from` sale siempre del token):
  - `GET /orla/next` responde `{ user, remaining }`: el siguiente Expediente (un estudiante activo, que no soy yo, al que no he votado y sin bloqueo entre
    los dos) con `{ _id, name, degree?, lookingFor?, bio?, photo?, birthDate? }`, y cuántos A+ me quedan hoy. Si no queda nadie, `user` es `null`.
  - `POST /orla/votes` con `{ to, value }` responde 201 `{ grade, date, remaining }`. `date` solo viene (si no, `null`) cuando el A+ forma un A+ mutuo y
    abre el Date. 422 si me voto a mí mismo, 403 si hay un bloqueo, 409 si ya había votado ese perfil, y 409 `Has llegado a los 30 A+ de hoy. Vuelve mañana.`
    al pasar del cupo (30 A+ por día natural; las F no cuentan). 404 si el votado no existe o no es estudiante.
  - `DELETE /orla/votes/:gradeId` deshace un voto propio con menos de 10 s y responde 200 `{ dateRemoved, remaining }`; si ese A+ había abierto un Date,
    `dateRemoved` es `true` y el Date se borra. 409 pasados los 10 s; 404 si el voto no es mío o no existe.

## Tareas

### Sprint 1 (mínimo 1)

#### Estructura (`structure`)

- [x] Crear los dos repositorios a partir del Seminari 7 (README y ramas) · Diego
- [x] Montar el GitHub Project y cargar las tareas · María
- [x] Hoja de horas del equipo · Miguel Ángel
- [x] Quitar autores, libros y chat del backend · María

#### Usuarios (`users`)

- [x] Modelo User ampliado (perfil, activo, archivado) y datos de ejemplo · Diego
- [x] Prehook de Mongoose "está activo" · Diego
- [x] Gestión de usuarios: listado paginado, búsqueda, editar y cambiar rol · Diego
- [x] Archivar, restaurar y eliminar para siempre (usuarios) · Diego

#### La Orla (`grades`)

- [x] Modelo Grade (La Orla) con sus rutas de admin · María

#### Dates (`dates`)

- [x] Modelo Date (citas) con sus rutas · María

#### Documentación (`docs`)

- [x] Documentación de la API en Swagger · Diego
- [x] Pruebas de la API (se hacen al cerrar cada rama y se apuntan en la bitácora) · Diego

#### Scrum

- [ ] Planning, seguimiento y retrospectiva · los tres
- [ ] Preparar la demo del sprint · Diego y María

### Sprint 2

#### Estructura (`feat/estructura`)

- [x] Sesión para la web, Docker y el móvil: CORS con varios orígenes, cookie del refresh configurable y refresh también en el body · María
- [x] Modelos Message, Block, Report y SafetyAlert, con sus índices y su validación con Joi · Miguel Ángel
- [x] Campos nuevos (contactos de confianza, historial y cierre de los Dates) y paginación de 10 por página · Miguel Ángel
- [x] Seed con datos de ejemplo de lo nuevo, Swagger y LOGS · Miguel Ángel

#### Primer despliegue en Docker (`feat/docker`)

- [x] Dockerfile de la API en dos etapas, sin dependencias de desarrollo y con el seed compilado · Diego

#### La Orla (`feat/orla`)

- [x] Siguiente Expediente: usuario activo, que no soy yo, que no he votado y sin bloqueos entre los dos · María
- [x] Votar como estudiante; el A+ mutuo abre el Date con el sorteo del turno · María
- [x] Cupo de 30 A+ al día (con su índice) y deshacer en 10 s · María

#### Mi perfil (`feat/perfil`)

- [x] GET y PUT /users/me: el estudiante edita sus datos, pero no su rol · Miguel Ángel
- [x] Contactos de confianza: opcionales y hasta 3 · Miguel Ángel

#### Mis Dates y chat (`feat/chat`)

- [x] socket.io de vuelta, con el JWT comprobado al conectar · Diego
- [x] Una sala por Date, turno de palabra y mensajes guardados (modelo Message) · Diego
- [x] Historial: los mensajes paginados y cada cambio de estado del Date en su history, con quién y cuándo. Estados automáticos y sin Dates a mano · Diego

#### Seguridad (`feat/seguridad`)

- [x] Bloquear (modelo Block) y su filtro en La Orla y en los chats · Miguel Ángel
- [x] Partes (modelo Report): solo los ve el admin, que les pone la gravedad y anota lo que ha hecho · María
- [x] Botón de ayuda (modelo SafetyAlert): aviso a los admin al momento y a los contactos de confianza si los hay, y atenderla · Diego

#### Segundo despliegue y cierre (`feat/cierre`, `feat/documentacion`)

- [ ] Segundo despliegue con todo y prueba de punta a punta en la web y en el móvil (pendiente del puerto que reenvía el proxy de la UPC) · Miguel Ángel
- [x] GitHub Actions: lint, build (y tests en el frontend) en cada push, en el backend y en el frontend · Diego
- [x] LOGS y README de los repos al día · Miguel Ángel
- [x] Diagrama de clases de la base de datos · María
- [x] Flujo de arquitectura: web, móvil, nginx, API, socket.io y MongoDB, y el camino de una petición con JWT (en el README de STUDATE---DOCKER) · Diego
- [ ] GitHub Project y Excel de horas al día (al hacer push) · Diego

## Bitácora

La bitácora del Seminario 7, de donde viene este código, se conserva en el tag `seminari7-base`
(`git show seminari7-base:LOGS.md`).

### 2026-11-03 · Punto de partida y `structure`

- El repositorio nace como copia del backend del ejercicio del Seminario 7. Antes de tocar nada se guarda ese
  código en el tag `seminari7-base`, para poder consultarlo cuando lo vayamos quitando.
- Identidad: el paquete pasa a llamarse `studate-backend`, el README cuenta qué es Studate y qué pide el
  mínimo 1, la base de datos por defecto pasa a ser `studate` y los secretos de clase de `.env.example`
  cambian de nombre. Swagger se titula "Studate API".
- Este LOGS.md empieza de cero con las tareas del Sprint 1 agrupadas por la rama en la que se hacen. Del
  contrato del seminario solo se queda la autenticación, que no cambia; lo demás se irá escribiendo en cada rama.
- Prompt de IA usado: «Lo que hemos hecho ha sido copiar y pegar lo que teníamos del seminario 7. Ahora hay que
  adaptarlo a lo nuestro, que es Studate. Para eso hay que hacer limpieza y dejar el repo preparado [...] Dime
  el plan de acción.» (conversación completa en `prompts/sprint-1.md`, fuera del repositorio).

### 2026-11-03 · Limpieza: fuera autores, libros y chat

- Se borran los modelos, controllers, services y rutas de autores y libros, el modelo `Message`, la carpeta
  `sockets/` (chat y avisos del backoffice), el middleware `SocketAuth` y los dos scripts de migración del
  seminario (`migrate-authors` y `migrate-indexes`), con sus comandos de `package.json`. Se desinstala `socket.io`.
- `server.ts` deja de montar `/authors`, `/books` y socket.io; sigue creando el servidor con `http.createServer`.
- Desaparece `GET /users` (la lista de id y nombre para el chat directo). `GET /users/me` se queda: el frontend lo
  usa para recuperar la sesión.
- Se quedan las piezas genéricas que se van a reutilizar: `ValidatePagination` y el esquema de paginación de Joi,
  `ValidateId`, `ErrorHandler`, `RequireRole`, `VerifyToken`, `escapeRegExp` y las respuestas comunes de Swagger.
- El seed solo crea los dos usuarios; la rama `users` lo amplía.
- README: fuera las secciones del chat, de autores y libros y de las migraciones; la estructura del proyecto,
  los endpoints y la tabla de rutas protegidas quedan al día.
- Decisión: quitar en lugar de comentar. El código del seminario sigue entero en el tag `seminari7-base`
  (`git show seminari7-base:src/services/BookService.ts`), que es de donde se copiará la forma de la paginación y
  del borrado lógico.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores; `npm run seed -- --reset`; con la API
  arrancada, 8 pruebas con curl: login 200, `/users/me` 200 con token y 401 sin él, `/authors`, `/books` y `GET /users`
  404, `/api-docs` y `/ping` 200, y el documento de Swagger ya no tiene ninguna ruta ni esquema de autores o libros.
- Prompt de IA usado: el mismo de la limpieza del repositorio (ver la entrada anterior).

### 2026-11-03 · Modelo User ampliado y datos de ejemplo

- `User` pasa de `name`, `email`, `password` y `role` a tener también:
  - Perfil (opcional, como en el blog): `birthDate`, `degree` (titulación), `lookingFor` ("Qué busco", 100
    caracteres como mucho), `bio` (500 como mucho) y `photo`.
  - Estado de la cuenta: `active` (`true` por defecto) y el borrado lógico `deleted` + `deletedAt`, con los mismos
    nombres que usaban autores y libros en el seminario.
- Decisión: el email sigue siendo único entre **todos** los usuarios, también los archivados (índice único normal,
  no parcial como el de autores). Así restaurar un usuario nunca choca con otro que se haya quedado su email.
- Decisión: la foto se guarda dentro del usuario como texto en base64, con un máximo de 200 000 caracteres
  (`PHOTO_MAX_LENGTH`). No hace falta guardar ficheros ni otra librería; el frontend la reduce antes de enviarla.
- Seed: 14 usuarios con perfiles de estudiantes de la EETAC (inventados), contraseña `studate26`. Dos están
  inactivos (`aina`, `iker`) y dos archivados (`sara`, `dani`), para probar las tareas siguientes.
- Swagger: el esquema `User` y su ejemplo llevan los campos nuevos. README: usuarios de ejemplo y campos del usuario.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores; `npm run seed -- --reset` crea 14 usuarios, y
  con `mongosh` se comprueba que hay 2 con `active: false`, 2 con `deleted: true` y las 14 contraseñas cifradas
  (`scrypt:...`). Con la API arrancada, el login de `laia@example.com` devuelve el usuario con los campos nuevos y sin
  contraseña. Todavía un usuario inactivo puede iniciar sesión: lo resuelve el prehook (siguiente tarea).
- Prompt de IA usado: «Empezamos por el modelo User. Antes de tocar nada, dime qué campos tendría, cómo quedaría la
  estructura del modelo, y ponme ejemplos de cada campo para ver qué necesitamos de verdad.»

### 2026-11-03 · Prehook de Mongoose "está activo"

- Qué pide la tarea: que un usuario desactivado no pueda usar la aplicación, resuelto con un hook de Mongoose en
  lugar de repetir el filtro en cada consulta.
- `UserSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], ...)` añade
  `{ active: true, deleted: false }` a todas las consultas de usuarios. `findById` también queda filtrado, porque
  por dentro es un `findOne`. Se incluyen los archivados porque tampoco tienen que poder entrar.
- Para que el admin pueda ver y reactivar a todos, la consulta se salta el filtro con la opción propia
  `.setOptions({ withInactive: true })`, que el hook lee con `this.getOptions()`.
- Qué cambia sin tocar los services: el login (que busca por email) no encuentra al usuario inactivo o archivado
  y responde 401 con el mismo mensaje de siempre; el refresh (`findById`) también responde 401.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con un script de prueba con `tsx` (fuera del
  repositorio): `User.countDocuments()` da 10 y con `withInactive` da 14; `find()` igual; `findOne` de la usuaria
  inactiva da `null` y con `withInactive` la encuentra. Con la API arrancada, 6 logins: `laia` y `admin` 200; los
  inactivos `aina` e `iker` y los archivados `sara` y `dani`, 401 "Email o contraseña incorrectos".
- Prompt de IA usado: «Ahora el prehook de Mongoose de "está activo". No me acuerdo bien de en qué consistía.
  Explícame de qué va, por qué tiene sentido esta tarea, y dame el plan de acción.»

### 2026-11-03 · Gestión de usuarios: listado paginado, búsqueda, editar y cambiar rol

- Rutas de admin en `routes/Users.ts`, cada una con su cadena `VerifyToken` → `RequireRole('admin')` → validación →
  controller y su comentario de Swagger: `GET /users` (con filtros), `GET /users/:userId`, `POST /users` y `PUT /users/:userId`.
  `/me` va antes que `/:userId` para que Express no tome "me" por un id.
- El listado copia la forma de la paginación de libros del seminario (`skip`, `limit` y `countDocuments` con el mismo filtro,
  respuesta `{ users, total, page, pages }`) y le añade los filtros `role`, `active` y `archived`. Se validan con un esquema
  de Joi nuevo (`userList`) y el middleware `ValidateUserList`, que es igual que `ValidatePagination`: Joi convierte
  `"false"` de la URL en `false`.
- Las funciones del admin se saltan el prehook con `setOptions({ withInactive: true })`: si no, el admin no vería a los
  inactivos ni a los archivados.
- Joi: `user.create` y `user.update` comparten los campos del perfil (escritos una sola vez). La contraseña no está en
  `update`, así que enviarla da 422. La foto tiene que empezar por `data:image/png;base64,` o `data:image/jpeg;base64,`.
- Decisiones:
  - Un usuario archivado no se puede editar (404): primero hay que restaurarlo.
  - Un admin no puede cambiarse su propio rol ni desactivarse: 403 "No puedes hacer esto con tu propio usuario". Si se
    pudiera, el backoffice se podría quedar sin ningún admin.
- Contrato de la gestión de usuarios escrito arriba (y copiado al LOGS.md del frontend en su rama).
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con la API arrancada y el seed recién hecho, 30 pruebas con
  curl, todas correctas: listado por defecto (12 no archivados, 3 páginas de 5, sin contraseñas), `limit=10&page=2`, búsqueda por
  nombre y por email, `role=admin`, `active=false` (Aina e Iker), `archived=true` (Sara y Dani), 400 con `page=0` y con un rol que
  no existe; GET de una inactiva y de una archivada (200), de un id inexistente (404) y mal formado (400); POST correcto (201, sin
  contraseña en la respuesta), con email repetido (409), sin contraseña (422) y con una foto que no es imagen (422); PUT cambiando
  el rol, reactivando a Aina (y después su login da 200), a una archivada (404), con contraseña (422), el admin quitándose el rol
  o desactivándose (403) y editando su nombre (200); como `user`, 403 en listado, detalle y creación; sin token, 401.
- Prompt de IA usado: «Siguiente: gestión de usuarios, listado paginado, búsqueda, editar y cambiar rol. Hay que montar esta
  funcionalidad. ¿Cómo lo harías? ¿Cuál sería el plan de acción?»

### 2026-11-03 · Archivar, restaurar y eliminar para siempre

- Soft delete y hard delete, como se explicó en clase: el borrado normal es lógico (archivar) y se puede deshacer; el
  borrado físico existe, pero solo para usuarios ya archivados.
- `POST /users/:userId/archive` pone `deleted: true` y `deletedAt`, igual que hacía `deleteBook` en el seminario.
  `POST /users/:userId/restore` lo deshace (con `$unset` se quita `deletedAt`). Los dos usan `findOneAndUpdate` con
  `deleted` en el filtro, así que archivar dos veces o restaurar uno que no está archivado da 404.
- `DELETE /users/:userId` borra el documento con `deleteOne`. El service devuelve qué ha pasado (`'deleted'`,
  `'not-found'` o `'not-archived'`) y el controller elige el código: 204, 404 o 409. Se ha elegido así para que el
  service no sepa nada de HTTP, como el resto de services.
- Un admin no puede archivarse ni eliminarse a sí mismo (403, el mismo mensaje que en la edición).
- Queda apuntado en `deleteUser` que, cuando existan los votos de La Orla y los Dates, también habrá que borrar los del usuario.
- README: sección "Borrado lógico y borrado físico" con el porqué de los dos pasos. Swagger: las tres rutas y la respuesta `NotArchived`.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con el seed recién hecho, 18 pruebas con curl, todas correctas:
  archivar a Laia (200, con `deleted` y `deletedAt`), ya no sale en el listado y sí en `archived=true`, su login da 401, archivarla
  otra vez 404, restaurarla (200, sin `deletedAt`) y su login vuelve a dar 200, restaurar una no archivada 404, `DELETE` sin
  archivar 409, archivar y `DELETE` 204, después su GET y otro `DELETE` 404, el admin archivándose o eliminándose 403, un `user`
  haciéndolo 403 e id mal formado 400. En MongoDB quedan 13 usuarios y ninguno con el email de Laia.
- Pruebas del bloque `users`: además de las de cada tarea (6 logins del prehook, 30 de la gestión y estas 18), se repite todo
  sobre una base de datos recién sembrada y sale igual.
- Prompt de IA usado: «Ahora archivar, restaurar y eliminar para siempre usuarios. ¿Cómo lo harías? Y recuérdame cómo era esto del
  soft delete y el hard delete [...] Dame el plan de acción.»

### 2026-11-03 · Filtro por titulación en el listado de usuarios

- Al montar la lista de usuarios del backoffice (frontend) propusimos filtrar por rol, estado, archivados y titulación, y el
  último no existía en la API. Se vuelve a la rama `users` y se añade `degree` a `GET /users`: Joi lo valida (texto de 100
  caracteres como mucho) y el service lo añade al filtro solo si viene. Tiene que coincidir entera, porque en el frontend se
  elige de una lista.
- Contrato, Swagger y README al día.
- Validación ejecutada: `npm run build` y `npm run lint`; con curl, `degree=Grau en Enginyeria Aeroespacial` devuelve solo los
  de Aeroespacial y combinado con `active=true` sigue funcionando.
- Prompt de IA usado: «Empezamos por la lista de usuarios paginada con búsqueda y filtros [...] quiero 10 usuarios por página y
  algunos filtros, los más típicos. ¿Qué filtros me sugieres?» (conversación del frontend).

### 2026-11-03 · Un usuario desactivado deja de poder usar la API al momento

- Al hacer el formulario de usuario (frontend) salió el problema: "si un usuario no está activo, no puede usar la API". El prehook solo
  actuaba en el login y en el refresh; un usuario con sesión al que el admin desactivaba seguía usando la API con su access token hasta
  que caducaba (15 minutos como mucho), que es justo el límite que se había dejado documentado. Se vuelve a la rama `users` para
  arreglarlo.
- `VerifyToken` pasa a ser `async` y, después de verificar el token, busca al usuario con `UserService.getUserById`. Como pasa por el
  prehook, no encuentra a los inactivos ni a los archivados: en ese caso responde 401 "Tu cuenta no está activa". El interceptor del
  frontend, con un 401 que no es de token caducado, ya cerraba la sesión y llevaba al login, así que allí no hay que tocar nada.
- Decisión: el rol sigue saliendo del token (es lo que pide el enunciado: el rol en el payload del JWT); solo se mira en la base de datos
  si la cuenta sigue activa.
- Validación ejecutada: `npm run build` y `npm run lint`; con curl, Laia con su token: `/users/me` 200; el admin la desactiva y con el
  mismo token responde 401 "Tu cuenta no está activa"; reactivada, 200 otra vez; archivada, 401; las rutas del admin siguen dando 200 y
  sin token 401.
- Prompt de IA usado: «Lo de activo es importante, porque todo lo que venga después tiene que saber si un usuario está activo o no: si
  no lo está, no puede usar la API.» (conversación del formulario de usuario, en el frontend).

### 2026-11-03 · Modelo Grade (La Orla) con sus rutas de admin

- Qué es un voto, según el blog: en La Orla cada estudiante ve perfiles (el "Expediente") y a cada uno le pone A+ (aprobado) o F
  (suspenso). Si dos se ponen A+ mutuamente se abre un Date (rama `dates`). Atributos: `from` (quien vota), `to` (a quien), `value`
  (`'A+'` o `'F'`, en `GRADE_VALUES`) y las fechas de `timestamps`. No hace falta nada más para el mínimo 1; lo del límite de 30 A+ al día y
  los 10 segundos para deshacer es de la app, no del backoffice.
- `from` y `to` son referencias a `User` (como los autores de un libro en el seminario). Índice único `{ from, to }`: un usuario solo vota una
  vez a cada perfil y el 409 sale solo del `ErrorHandler`.
- Cuidado encontrado con el prehook de usuarios: el `populate` de `from` y `to` también es una consulta a `User`, así que un usuario inactivo
  salía como `null`. Se hace el `populate` con `options: { withInactive: true }` y solo con `name`, `email` y `photo`.
- `createGrade` comprueba antes que no sea un voto a uno mismo y que los dos usuarios existan, y devuelve `{ error }` o `{ grade }` para que el
  controller elija 422, 404 o 201.
- Rutas de admin en `routes/Grade.ts` con su Swagger: listado paginado (filtros `value` y `user`, validados con `ValidateGradeList`), ver,
  crear, cambiar la nota y eliminar (borrado físico: un voto no se archiva).
- Al eliminar un usuario para siempre se borran también sus votos (en `UserService.deleteUser`), para que no queden votos de alguien que ya no
  existe.
- Seed: 25 votos entre usuarios activos, con 4 parejas de A+ mutuo (Laia y Pau, Nerea y Marc, Hugo y Júlia, Usuario y Oriol) para los Dates.
  Igual que los libros del seminario, cada voto se escribe con los emails y el script los cambia por ids.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores; `npm run seed -- --reset` crea 14 usuarios y 25 votos. Con la API, 19
  pruebas con curl, todas correctas: listado (25 en 5 páginas, con nombres poblados), `value=A+` (16), `user` (los 7 de Laia), 400 con una nota
  o un id no válidos; GET de uno (200) y de uno inexistente (404); POST de una usuaria inactiva (201 y su nombre no sale `null`), pareja
  repetida (409), voto a sí misma (422), `from` inexistente (404 con su mensaje) y nota no válida (422); PUT a F (200) y con `from` en el body
  (422); DELETE (204) y otra vez (404); como `user` 403 y sin token 401. Además, eliminar para siempre a una usuaria archivada con un voto deja
  0 votos suyos en MongoDB.
- Prompt de IA usado: «Montamos lo mismo con el modelo Grade, el de La Orla. ¿Qué atributos necesita este modelo para lo que queremos montar
  en Studate? Dame el plan de acción.»

### 2026-11-03 · Modelo Date (citas) con sus rutas

- Qué es un Date, según el blog: si dos usuarios se aprueban mutuamente en La Orla se abre un Date; un sorteo decide quién escribe
  primero; hay 24 horas y una prórroga; y bandejas "Pendientes" y "En curso". Atributos: `users` (los dos, referencias a `User`),
  `status` (`pending`, `ongoing` o `closed`, en `DATE_STATUSES`), `firstTurn` (el sorteado), `expiresAt` y `extended` (la prórroga),
  más las fechas de `timestamps`.
- Problema de nombres: un modelo llamado `Date` tapa la clase `Date` de JavaScript en el fichero que lo importa (`new Date()` dejaría de
  funcionar). El modelo de Mongoose se llama `'Date'` (colección `dates`), pero en el código se importa como `DateModel`, con las
  interfaces `IDate` e `IDateModel`. Está explicado arriba del modelo.
- El "match": `openDateIfMutual(from, to)` en `DateService` busca el A+ contrario y, si existe y no hay ya un Date entre los dos, lo abre.
  La llama `GradeService` al crear un A+ y al cambiar un voto a A+. Cambiar un A+ a F no cierra el Date que ya estuviera abierto.
- `createDate` comprueba que los dos usuarios existen y que no hay ya un Date entre ellos (`users: { $all: [a, b] }`, sin importar el
  orden), sortea `firstTurn` con `Math.random()` y pone `expiresAt` a 24 horas (`DATE_DURATION_MS`). La prórroga suma 24 horas y solo se
  puede usar una vez (409).
- Decisión (del mockup): los Dates no son solo del backoffice. Cualquier usuario con sesión ve, cambia de bandeja, prorroga y abre **sus**
  Dates; el admin, todos. Lo hace el service con un filtro según `req.user` (`visibleTo`): un Date de otros le da 404 al usuario, para no
  revelar que existe. Un usuario normal solo puede abrir Dates en los que está él (403). Eliminar es solo del admin (`RequireRole`).
- Como en los votos, el `populate` de `users` lleva `withInactive` para que un usuario inactivo no salga `null`.
- Al eliminar un usuario para siempre se borran también sus Dates.
- Seed: los Dates salen de los votos con la misma regla que la API (`openDateIfMutual` por cada A+): 4 Dates, de los que uno pasa a "En
  curso" (con la prórroga usada) y otro a "Cerrado" (ya caducado), para que haya de todo. El `--reset` borra también los Dates.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores; seed con 14 usuarios, 25 votos y 4 Dates. Con la API, 27 pruebas con curl:
  como admin, listado (4, con nombres), `status=pending` (2), `user` (1) y 400 con un estado que no existe; como `user`, solo ve el suyo (y el
  filtro `user` no le deja ver otros), GET y PUT de uno ajeno 404, de uno suyo 200, estado no válido 422, prórroga (200, exactamente 24 horas
  más) y otra vez 409, abrir un Date con Clara 201 y entre otros dos 403, `DELETE` 403; como admin, pareja repetida en otro orden 409, usuario
  inexistente 404, un solo usuario o el mismo dos veces 422, `DELETE` 204 y otra vez 404; sin token 401. Una prueba del match estaba mal
  planteada (Clara ya había votado a Hugo en el seed: el POST daba 409, que es lo correcto); se repite cambiando los dos votos a A+ y el
  Date se abre al formarse el A+ mutuo, y volver a poner A+ no abre un segundo Date. Eliminar a Laia (archivada) borra su Date.
- Prompt de IA usado: «Igual con el modelo Date, el de las citas. ¿Qué atributos necesita para lo que queremos en Studate? Dame el plan de acción.»

### 2026-11-03 · Con quién se puede abrir un Date

- Al hacer las pantallas de Dates (frontend) salió que un usuario normal no tiene de dónde sacar la lista de personas para "Nuevo Date": `GET /users`
  es solo del admin. Se añade `GET /users/directory` para cualquier usuario con sesión: los demás usuarios de rol `user` activos (el prehook ya quita
  a los inactivos y archivados), ordenados por nombre y solo con `name`, `degree` y `photo`, que es lo que se ve de alguien en la app (nada de email
  ni de rol). Va antes que `/:userId` en el router.
- Validación ejecutada: `npm run build` y `npm run lint`; con curl, como `user@example.com` devuelve 8 usuarios: sin él mismo, sin el admin, sin los
  inactivos y sin los archivados, y sin email; sin token, 401.
- Prompt de IA usado: «Las pantallas de Dates, igual que las de La Orla: primero el mockup para verlo, y responsive desde el principio [...]»
  (conversación del frontend).

### 2026-11-03 · Mensaje claro al repetir un voto de La Orla

- Al repasar Swagger salió que el 409 de un voto repetido decía `"from ya existe"`: lo construía el `ErrorHandler` con el primer campo del
  índice único `{ from, to }`. En el frontend se habría visto tal cual al cargar un voto repetido.
- `GradeService.createGrade` comprueba antes de guardar si la pareja ya tiene voto y devuelve `{ error: 'already-voted' }`; el controller
  responde 409 "Este usuario ya ha votado ese perfil", igual que hacen los Dates con su 409. El índice único se queda como red de seguridad.
- Validación ejecutada: `npm run build` y `npm run lint`; con curl, repetir el voto más reciente responde 409 con el mensaje nuevo (antes,
  "from ya existe").
- Prompt de IA usado: «Toca montar la documentación de la API en Swagger. Ya has visto cómo lo hacemos: Joi conectado con Swagger.
  Simplemente sería ampliarlo con todo lo nuevo.» (salió durante el repaso).

### 2026-11-03 · Repaso de la documentación de Swagger

- Cada ruta se documentó al crearla, con `@openapi` encima y los esquemas del body sacados de Joi con `joi-to-swagger`. En esta tarea se
  compara el documento generado (`/api-docs`) con las rutas reales: están las 25 rutas, con su etiqueta (Health, Auth, Users, Grades y
  Dates), y solo `/auth/*` y `/ping` van sin candado.
- Se revisa, ruta por ruta, que los códigos documentados sean los que responde cada controller. Arreglado:
  - El 401 (`Unauthorized`) ahora dice que también sale cuando la cuenta ya no está activa ("Tu cuenta no está activa"), y el login avisa de
    que un usuario inactivo o archivado recibe 401.
  - `POST /grades` 409, `POST /dates` 409 y `POST /dates` 403 usaban las respuestas genéricas (con el ejemplo "email ya existe" o "Necesitas
    el rol admin"): ahora tienen las suyas (`GradeConflict`, `DateConflict` y `NotYourDate`) con el mensaje real. Al revisar el de los votos
    salió que el mensaje real era "from ya existe", y se arregló en el backend (entrada anterior).
  - `DELETE /users/:userId` dice que borra también los votos y los Dates del usuario, y el tag Users menciona `/users/directory`.
- README: cómo se ha probado la API y qué tiene cada respuesta de error de Swagger.
- Pruebas de la API: no hay tests automáticos en el backend. Al cerrar cada rama se han hecho las pruebas con curl contra la API y el seed
  recién hecho, y están en la bitácora: 8 de la limpieza, 6 del prehook, 30 de la gestión de usuarios, 18 del archivado, 19 de La Orla y 27 de
  los Dates (más la del match repetida), además de las de cada arreglo. Se marca la tarea con eso; los tests automáticos quedan como mejora
  para el Sprint 2.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores; el documento de Swagger generado tiene las 25 rutas y los esquemas User,
  Grade, Date y sus Input; la página `/api-docs` carga con las 5 etiquetas, las 25 rutas con su candado (o sin él en `/auth/*` y `/ping`) y
  los esquemas. Las llamadas se han probado con curl, no desde los botones de la página.
- Prompt de IA usado: «Toca montar la documentación de la API en Swagger. Ya has visto cómo lo hacemos: Joi conectado con Swagger.
  Simplemente sería ampliarlo con todo lo nuevo.»

### 2026-11-25 · Sprint 2: la estructura (`feat/estructura`)

- El Sprint 2 cambia el frontend: el backoffice en Angular se rehace en React y aparecen la web del estudiante y la app del móvil. Esta rama deja
  el backend preparado para los tres antes de hacer ninguna pantalla.
- **Sesión para la web, Docker y el móvil.** `CORS_ORIGIN` pasa a ser `CORS_ORIGINS`, una lista separada por comas (por defecto, la web de Vite en el
  5173 y Expo en el navegador en el 8081); al paquete `cors` se le pasa la lista y él responde solo a esos orígenes. La cookie del refresh token
  tiene la ruta y el `Secure` configurables (`REFRESH_COOKIE_PATH` y `COOKIE_SECURE`): en el servidor, nginx servirá la API detrás de `/api` y el
  navegador solo envía la cookie si su ruta es `/api/auth`. La app del móvil no tiene cookies HttpOnly: con la cabecera `X-Client: movil`, el login
  le devuelve el refresh token en el JSON, y `/auth/refresh` lo acepta en el body. La web sigue exactamente igual.
- Dos decisiones que no estaban en el plan: con `X-Client: movil` no se pone cookie, y en el refresh manda el body sobre la cookie. Un teléfono
  también guarda cookies; si mandara la cookie, una de una sesión anterior podría renovar la cuenta equivocada.
- **Modelos nuevos**: `Message`, `Block`, `Report` y `SafetyAlert`, según el plan de la base de datos. Índices: `(date, createdAt)` en los
  mensajes y único `(blocker, blocked)` en los bloqueos. Llevan ya sus esquemas de Joi; en ninguno se acepta quién hace la petición, que saldrá
  siempre del token. Todavía no tienen rutas: llegan con el chat y con la seguridad.
- **Campos nuevos**: `User.trustedContacts` (opcionales, hasta 3). Son datos privados y de personas que no usan Studate, así que van con
  `select: false`, como la contraseña: no salen en ninguna consulta si no se piden a propósito. `Date` gana `startedAt`, `closedAt`,
  `closedReason` e `history`; `createDate` escribe ya la primera entrada (`pending`) y el resto de cambios de estado se registrarán cuando
  llegue el chat. Índice `(status, expiresAt)` para el cierre de los caducados.
- **Paginación de 10**: el valor por defecto de `limit` está en una constante (`PAGE_SIZE`) que usan los cinco listados.
- **Arreglo de algo anterior**: al eliminar un usuario para siempre se borraban sus Dates, pero no los Planes de esos Dates, que se quedaban
  apuntando a un Date que ya no existe. Ahora con cada Date se borran su Plan y sus mensajes, y con el usuario, además, sus bloqueos, sus partes
  y sus alertas.
- **Seed**: dos usuarios con contactos de confianza, el Date en curso con su historial y cuatro mensajes, el Date cerrado con su motivo, un
  bloqueo, dos partes (uno abierto y otro revisado con su gravedad) y dos alertas (una abierta y otra atendida). `npm run seed -- --reset` borra
  también las colecciones nuevas.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con curl contra la API y el seed recién hecho: el preflight desde
  `localhost:5173` trae `Access-Control-Allow-Origin` y desde `localhost:4200` no; el login de la web pone la cookie y no trae `refreshToken`
  en el JSON; el del móvil (`X-Client: movil`) lo trae y no pone cookie; el refresh responde 200 con la cookie, 200 con el body, 401 sin nada,
  401 con un token falso y 422 si `refreshToken` no es un texto; con cookie de un usuario y body de otro, el token nuevo es del usuario del
  body. `GET /users` y `GET /grades` sin `limit` devuelven 10 elementos. En MongoDB están las cuatro colecciones nuevas con sus índices. Al
  eliminar un usuario con un Date y un Plan no queda ningún Plan huérfano. El login no devuelve los contactos de confianza. El documento de
  Swagger tiene los esquemas nuevos, el parámetro `X-Client` del login y los dos modos del refresh.
- Prompt de IA usado: el del bloque "Estructura" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

### 2026-11-25 · Sprint 2: la imagen de Docker de la API (`feat/docker`)

- `Dockerfile` en dos etapas, como en el Seminario 10: `node:24-alpine` compila el TypeScript y una segunda imagen limpia se queda solo
  con `build/` y las dependencias de producción (312 MB; sin TypeScript ni tsx, y corre como el usuario `node`). `.dockerignore` deja fuera
  `node_modules`, `build`, `.git`, la documentación y cualquier `.env`: la configuración llega en variables de entorno al arrancar.
- A diferencia del seminario, el seed va dentro de la imagen, compilado (`build/seed.js`): así se llena la base de datos del servidor sin
  tener el código allí. El compose del repo STUDATE---DOCKER lo ejecuta en cada arranque (solo inserta si la base está vacía).
- Workflow de GitHub Actions (`.github/workflows/ci.yml`): lint y build en cada push y pull request; en los push, además, publica la imagen
  en ghcr.io (`latest` desde `main` y `develop` desde `develop`). El paquete hay que ponerlo público una vez para que el servidor lo baje.
- README: sección Docker, con cómo construir, ejecutar y sembrar.
- Validación ejecutada: `docker build` sin errores; dentro de la imagen están `build/seed.js` y `build/server.js`, no están `tsx` ni
  `typescript`, y el proceso corre como `node`. Con un MongoDB en una red de Docker sin puerto público: el seed crea todo (14 usuarios, 25
  votos, 4 Dates, 3 Planes, 4 mensajes, 1 bloqueo, 2 partes y 2 alertas), `/ping` responde y el login de Laia deja la cookie con
  `Path=/api/auth` y sin `Secure` (`REFRESH_COOKIE_PATH=/api/auth`, `COOKIE_SECURE=false`). El workflow no se ha podido ejecutar todavía:
  lo hará el primer push.
- Prompt de IA usado: el del bloque "Primer despliegue en Docker" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

### 2026-11-25 · Sprint 2: La Orla del estudiante (`feat/orla`)

- La Orla es la pantalla del estudiante (como un Tinder, pero de estudiantes): te sale el Expediente de alguien y le pones A+ o F; dos A+ cruzados abren
  un Date. Va en un router nuevo `/orla`, separado del `/grades` de admin, y todas sus rutas piden rol `user`. El que vota sale siempre del token.
- **Siguiente Expediente** (`GET /orla/next`): un estudiante activo (el prehook ya quita inactivos y archivados), que no soy yo, al que no he votado y
  sin bloqueo (modelo Block) en ninguno de los dos sentidos. Devuelve solo datos públicos del Expediente y, en la misma respuesta, cuántos A+ me quedan hoy.
- **Votar** (`POST /orla/votes`): no se puede votar a uno mismo (422), a un bloqueado (403) ni dos veces (409). Si es A+ y la otra persona ya me había
  dado A+, se reutiliza `openDateIfMutual` (que sortea el turno y escribe el primer evento del history) y el Date va en la respuesta.
- **Cupo y deshacer**: 30 A+ por día natural (los de hoy se cuentan con el índice nuevo `(from, value, createdAt)`); el 31.º da 409, la F no cuenta.
  `DELETE /orla/votes/:gradeId` deshace un voto propio con menos de 10 s; si ese A+ había abierto un Date, se borra también (con la cascada de
  `deleteDate`). Pasados los 10 s, 409; el voto de otro, 404.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con la API y el seed recién hecho, 23 comprobaciones con `fetch` (equivalente a curl),
  todas correctas: el siguiente perfil no incluye al votado ni a uno mismo ni a un bloqueado y trae `remaining`; un A+ a quien ya me había dado A+ abre el
  Date con `history [pending]`; votar dos veces da 409 y votarse a uno mismo 422; votar a un bloqueado da 403 y el bloqueado no sale en La Orla; deshacer
  dentro de 10 s da 200 y borra el Date del A+ mutuo; deshacer el voto de otro da 404; el admin recibe 403; el A+ número 31 da 409 y la F sí se permite;
  deshacer a los 11 s da 409. El índice `(from, value, createdAt)` aparece en MongoDB.
- Prompt de IA usado: el del bloque "3 · La Orla" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

### 2026-11-25 · Sprint 2: Mi perfil (`feat/perfil`)

- `GET /users/me` pasa a devolver el perfil completo del usuario con sesión, incluidos los contactos de confianza, que tienen `select: false` en el
  modelo y se piden a propósito solo aquí (`getMe`): el resto de la app nunca ve los contactos de nadie. `VerifyToken` sigue usando la versión
  ligera (`getUserById`) para no cargar el perfil en cada petición.
- `PUT /users/me` (`updateMe`) edita nombre, fecha de nacimiento, titulación, "qué busco", bio y foto. El esquema de Joi (`user.updateMe`) no tiene
  `email`, `role` ni `active`: enviarlos responde 422, y así un estudiante no puede cambiarse el rol. La ruta va antes que `/:userId`, como el GET.
- Contactos de confianza en el mismo PUT: lista opcional de hasta 3 `{ name, email, phone? }`; `[]` los quita; el cuarto, 422 (lo valida Joi y,
  como segunda capa, el modelo).
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con curl y el seed recién hecho: `GET /users/me` de Laia trae titulación y
  sus 2 contactos y nunca la contraseña; `PUT` cambia la bio y el nombre (200); con `role: admin` y con `email` responde 422 y el rol sigue siendo
  `user`; sin token, 401. Con Pau: sin contactos al principio (0), guarda 2 (200), el cuarto da 422, un contacto sin email da 422, `[]` los deja a 0
  y un perfil sin contactos se guarda igual (200).
- Prompt de IA usado: el del bloque "4 · Mi perfil" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

### 2026-11-25 · Sprint 2: Mis Dates y chat (`feat/chat`)

- **socket.io de vuelta**: `StartChat` engancha socket.io al mismo servidor HTTP que Express (mismo puerto; nginx ya reenvía `/socket.io/`), con los
  mismos orígenes de CORS que la API. `VerifySocketToken` (`middleware/SocketAuth.ts`) es el `VerifyToken` del chat: lee el token del handshake
  (`auth.token`), comprueba la firma y la caducidad y que el usuario siga activo; si falla, `connect_error` con el mismo mensaje que el 401 de la API,
  para que el frontend reaccione igual (renovar con "El token ha caducado", cerrar la sesión con el resto). El usuario queda en `socket.data.user`.
- **Una sala por Date** (`sockets/Chat.ts` y `services/ChatService.ts`): `date:join` solo deja entrar a los dos usuarios del Date (para un tercero el
  Date "no existe"); `date:message` exige haber entrado, valida el texto con el mismo esquema de Joi que usaría una ruta (1 a 1000 caracteres) y guarda
  el mensaje con el `from` del token. Turno de palabra: en un Date pendiente solo escribe `firstTurn`; el primer mensaje lo pasa a En curso y la sala
  recibe el Date actualizado (`date:updated`). En un Date cerrado se entra a leer, pero no se escribe. `date:read` marca `readAt`.
- **Historial**: `GET /dates/:dateId/messages` paginado con la página 1 en los más nuevos (y cada página en orden cronológico), usando el índice
  `(date, createdAt)`. Cada movimiento del Date queda en su `history` con quién y cuándo: el primer mensaje (`by` quien escribió), la prórroga
  (`Prórroga de 24 horas`), los cambios del admin (`PUT` con `reason` opcional; `closedReason: 'admin'`) y el cierre por caducidad, que hace el servidor
  cada minuto (`jobs/ExpireDates.ts`, `closeExpiredDates` con el índice `(status, expiresAt)`; sin `by`, `closedReason: 'expired'`). Un Date en curso no
  caduca. `POST /dates` y `PUT /dates/:dateId` pasan a ser solo del admin: los estudiantes no abren ni cambian Dates a mano. Las rutas que cambian un
  Date avisan a su sala con `emitDateUpdated`, así que la otra persona ve la prórroga o el cierre sin recargar.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con la API, el seed recién hecho y `socket.io-client`, 56 comprobaciones, todas
  correctas. Conexión (8): sin token, token falso, caducado, firmado con otro secreto, un refresh token y un usuario inactivo se rechazan con su
  mensaje; un token válido conecta. Salas y turno (23): un tercero no entra; escribir sin entrar, un texto vacío o de 1001 caracteres dan error; quien no
  tiene el turno no puede empezar; el primer mensaje llega a los dos con su `_id`, el Date pasa a En curso con `startedAt` = hora del mensaje y el
  `history` con `by`; después escribe la otra persona; `date:read` avisa; en un Date cerrado no se escribe; tras `date:leave` no llegan mensajes. Historial y
  estados (25): 4 mensajes del seed en orden, paginación de 2 en 2, `page=0` 400, un tercero 404 y el admin 200; `POST /dates` y `PUT` de un estudiante
  403; el admin abre con su `by`, cierra con `closedReason: admin` y `reason`, reabrir quita `closedAt`, el mismo estado no repite evento; la prórroga
  entra en el `history` y la otra persona la recibe por el socket, la segunda da 409 y en un Date cerrado 409; un Date pendiente con `expiresAt` pasado
  lo cierra el servidor en la siguiente vuelta, la sala recibe `date:updated` con `closedReason: expired` y un `history` sin `by`, y ya no se puede escribir.
- Prompt de IA usado: el del bloque "5 · Mis Dates y chat" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

### 2026-11-25 · Sprint 2: Seguridad (`feat/seguridad`)

- **Bloquear** (`/blocks`, `BlockService`): un estudiante bloquea a otro y, si tenían un Date abierto, se cierra en el mismo paso (`closedReason:
  'blocked'`, con el bloqueo en el `history` y aviso a la sala del chat con `date:updated`, así la otra persona ve el chat cerrado sin recargar pero
  sin que se le diga que es un bloqueo). La Orla ya filtraba los bloqueos en los dos sentidos (bloque 3), y el chat no deja escribir en un Date
  cerrado (bloque 5): con eso, ninguno vuelve a ver al otro. Desbloquear no reabre el Date. A la persona bloqueada no se le avisa y no hay ruta con
  la que pueda saberlo.
- **Partes** (`/reports`, `ReportService`): el estudiante manda el parte (motivo, comentario y, si viene del chat, el Date, que tiene que ser suyo con
  esa persona) y solo el admin los lista (con filtros por estado, gravedad y persona), los ve y los revisa poniendo la gravedad y lo que ha hecho;
  queda `reviewedBy` y `reviewedAt`. Un estudiante recibe 403 en todo lo que no sea mandarlo. Nada automático: el admin decide.
- **Botón de ayuda** (`/alerts`, `SafetyAlertService`): todo opcional al pedir ayuda (quien la pide no está para formularios). Los admin conectados
  la reciben al momento por el socket: al conectar, un socket con rol `admin` entra solo en la sala `admins` y le llegan `alert:new` y
  `alert:updated` (al atenderla). Los contactos de confianza se avisan de forma simulada (una línea en el log por contacto, como el email de
  bienvenida); sin contactos, la alerta se crea igual y `contactsNotified` es 0. Atender deja `attendedBy` y `attendedAt`.
- Validación ejecutada: `npm run build` y `npm run lint` sin errores. Con la API, el seed recién hecho y `socket.io-client`, 43 comprobaciones, todas
  correctas. Bloqueos (16): a uno mismo 422, a alguien inexistente o al admin 404, el admin 403; Laia bloquea a Pau y llega el Date cerrado por
  bloqueo con su `history`, Pau lo recibe por el socket y ya no puede escribir; bloquear dos veces 409; la lista trae a Pau con su nombre; Pau no
  puede votar a Laia y no ve ningún bloqueo; desbloquear 204 y después 404; el Date sigue cerrado. Partes (15): sobre uno mismo, motivo inválido y
  Date ajeno 422; desde el chat 201 abierto con los dos usuarios; sin Date también; un estudiante 403 en la lista y en el detalle; el admin lista,
  filtra por estado y por persona, un filtro inválido 400; revisar dejándolo abierto 422; revisar guarda gravedad, resolución, quién y cuándo;
  inexistente 404. Ayuda (12): Date ajeno 422, admin 403; Laia (2 contactos) 201 con `contactsNotified: 2` y dos avisos en el log; el admin recibe
  `alert:new` al momento y un estudiante no; Hugo sin contactos 201 con 0; la lista es solo del admin; atender guarda quién y cuándo y los admin
  reciben `alert:updated`; reabrir 422.
- Prompt de IA usado: el del bloque "6 · Seguridad" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

### 2026-11-25 · Sprint 2: cierre y documentación (`feat/documentacion`)

- **GitHub Actions**: el workflow `ci.yml` de este repo pasa `npm run lint` y `npm run build` en cada push y pull request a `main` y `develop`, y
  si es un push publica la imagen en ghcr.io (`:latest` desde `main`, `:develop` desde `develop`). El del frontend hace lo mismo con lint, tipos,
  tests y build. El backend no tiene tests automáticos: su validación son las pruebas con `fetch` y `socket.io-client` de cada rama, apuntadas en
  esta bitácora (56 en el chat, 43 en seguridad, 23 en La Orla).
- **Diagrama de clases**: `docs/diagrama-bd.svg`, enlazado desde el README. Se genera a partir del fichero de datos del equipo (el mismo del visor de
  la base de datos del blog) y se ha comprobado modelo a modelo contra `src/models/`: los campos, los índices (`(from, value, createdAt)` del cupo,
  `(status, expiresAt)` del cierre, `(date, createdAt)` del chat, los únicos de email, `(from, to)`, `(blocker, blocked)` y `date` del Plan) y las
  reglas del Sprint 2 coinciden con el código.
- **README y LOGS al día**: el README describe las rutas nuevas (chat, bloqueos, partes y alertas), el socket y quién puede qué; el contrato de
  este LOGS tiene todas las rutas y eventos del sprint, con sus códigos y mensajes.
- **Flujo de arquitectura**: en el README de [STUDATE---DOCKER](https://github.com/mariacazorla/STUDATE---DOCKER), con el diagrama de la web, el
  móvil, nginx, la API, socket.io y MongoDB, y el camino de una petición con JWT y de un mensaje del chat.
- **Segundo despliegue**: preparado en STUDATE---DOCKER para el servidor detrás del proxy de la UPC (HTTPS lo termina el proxy; la VM sirve http y la
  API pone la cookie `Secure`). Queda hacerlo cuando se sepa a qué puerto de la máquina reenvía el proxy cada dominio.
- Prompt de IA usado: el del bloque "9 · Segundo despliegue y cierre" del Sprint 2, que está entero en [AI_LOG.md](AI_LOG.md).

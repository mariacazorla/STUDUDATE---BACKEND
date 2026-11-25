# AI_LOG

Herramienta: Claude Code (Anthropic). Modelo: Claude Opus 5.5.

## 1. Limpieza del código del Seminario 7

- **Pregunta:** cómo quitar autores, libros y chat del seminario y dejar el repo preparado para Studate.
- **Prompt:** «Lo que hemos hecho ha sido copiar y pegar lo que teníamos del seminario 7. Ahora hay que adaptarlo a lo nuestro, que es Studate. Para eso hay que hacer limpieza y dejar el repo preparado: quitar los autores, los libros y el chat, y dejar la estructura simple, la cáscara, para luego poner lo nuestro. De momento solo quitar y limpiar, para tener una base sólida. Dime el plan de acción: cómo lo eliminarías y cuál sería la forma correcta de hacerlo.»
- **Incoherencias:** ninguna importante.
- **Solución:** guardamos el código del seminario en el tag `seminari7-base` antes de borrar y mantuvimos las piezas genéricas (paginación, Joi, ErrorHandler, VerifyToken, RequireRole).

## 2. Modelo User

- **Pregunta:** qué campos necesita el usuario de Studate.
- **Prompt:** «Empezamos por el modelo User. Antes de tocar nada, dime qué campos tendría, cómo quedaría la estructura del modelo, y ponme ejemplos de cada campo para ver qué necesitamos de verdad. Luego me pasas el plan de acción y lo vemos.»
- **Incoherencias:** no decía dónde guardar la foto de perfil.
- **Solución:** la foto se guarda en el propio usuario en base64 con un límite de tamaño. El email sigue siendo único también para los archivados.

## 3. Prehook "está activo"

- **Pregunta:** qué es el prehook de usuarios activos y cómo hacerlo.
- **Prompt:** «Ahora el prehook de Mongoose de "está activo". No me acuerdo bien de en qué consistía. Explícame de qué va, por qué tiene sentido esta tarea, y dame el plan de acción.»
- **Incoherencias:** el prehook solo frenaba el login y el refresh. Un usuario desactivado seguía usando la API con su token hasta que caducaba.
- **Solución:** `VerifyToken` comprueba en cada petición que el usuario sigue activo y si no responde 401.

## 4. Gestión de usuarios

- **Pregunta:** listado paginado con búsqueda, editar y cambiar rol.
- **Prompt:** «Siguiente: gestión de usuarios, listado paginado, búsqueda, editar y cambiar rol. Hay que montar esta funcionalidad. ¿Cómo lo harías? ¿Cuál sería el plan de acción?»
- **Incoherencias:** faltaba el filtro por titulación que luego pedía la pantalla del frontend.
- **Solución:** añadimos el filtro `degree` a `GET /users` (Joi, service y Swagger).

## 5. Archivar, restaurar y eliminar

- **Pregunta:** soft delete y hard delete de usuarios.
- **Prompt:** «Ahora archivar, restaurar y eliminar para siempre usuarios. ¿Cómo lo harías? Y recuérdame cómo era esto del soft delete y el hard delete, porque nos lo comentaron en clase y si no me equivoco había que usar soft delete: para gestionarlo bien, los usuarios se archivan más que eliminarse. Dame el plan de acción.»
- **Incoherencias:** ninguna importante.
- **Solución:** solo se puede eliminar un usuario archivado (409 si no) y un admin no se puede archivar ni eliminar a sí mismo.

## 6. Modelo Grade (La Orla)

- **Pregunta:** qué atributos necesita un voto de La Orla.
- **Prompt:** «Montamos lo mismo con el modelo Grade, el de La Orla. ¿Qué atributos necesita este modelo para lo que queremos montar en Studate? Dame el plan de acción.»
- **Incoherencias:** con el `populate`, un usuario inactivo salía como `null` (pasaba por el prehook). Y el 409 de un voto repetido decía "from ya existe".
- **Solución:** `populate` con `withInactive: true`, y comprobar antes de guardar si la pareja ya tiene voto para responder "Este usuario ya ha votado ese perfil".

## 7. Modelo Date

- **Pregunta:** qué atributos necesita un Date y cómo abrirlo con el A+ mutuo.
- **Prompt:** «Igual con el modelo Date, el de las citas. ¿Qué atributos necesita para lo que queremos en Studate? Dame el plan de acción.»
- **Incoherencias:** un modelo llamado `Date` tapa el `Date` de JavaScript. Y un usuario normal no tenía forma de sacar la lista de usuarios para abrir un Date (`GET /users` es solo del admin).
- **Solución:** el modelo se importa como `DateModel`. Añadimos `GET /users/directory` para cualquier usuario con sesión.

## 8. Swagger

- **Pregunta:** ampliar la documentación de Swagger con todo lo nuevo.
- **Prompt:** «Toca montar la documentación de la API en Swagger. Ya has visto cómo lo hacemos: Joi conectado con Swagger. Simplemente sería ampliarlo con todo lo nuevo.»
- **Incoherencias:** algunos errores usaban ejemplos genéricos que no eran los mensajes reales de la API.
- **Solución:** respuestas propias con el mensaje real (`GradeConflict`, `DateConflict`, `NotYourDate`) y el 401 de cuenta no activa.

# Mínimo 1

### 1. Requisitos del examen

- **Pregunta:** cómo vamos a trabajar durante el Mínimo 1.
- **Prompt:** «Estamos en el examen del mínimo 1 y ahora te paso los requisitos a cumplir. Hay que hacer commits constantes de cada cosa relevante que hagamos. Como lo hemos hecho en AI_LOG hay que registrar los prompts que hagamos en cada repositorio. Primero modificaremos el backend y luego el frontend, yo te dictaré el orden de las cosas. Una cosa que tiene que usarse bien es el JWT: lo que hagamos solo tiene que tener acceso el rol de admin, ya que modificaremos el backoffice, terreno del admin. En cada repositorio ya estamos en la rama develop; por cada feat relevante que hagamos tiene que estar en su propia rama con sus commits, que se acabarán pasando a develop y lo subiré yo a main.»
- **Incoherencias:** ninguna importante.
- **Solución:** una rama `feat/<modelo>` por funcionalidad que sale de `develop` y vuelve a ella con un merge `--no-ff`, sin push y sin tocar `main`. Las rutas nuevas llevan `VerifyToken` + `RequireRole('admin')` en el backend y `adminGuard` en el frontend. Los prompts se registran en `AI_LOG.md` y en `AI_LOG_M1.md`.

### 2. Elección del nuevo modelo

- **Pregunta:** qué modelo nuevo añadir que se relacione con una entidad existente que no sea User y que tenga un vector de subdocumentos con al menos 3 tipos de datos distintos.
- **Prompt:** «Empezaremos a crear un nuevo modelo tanto en el backend como en el frontend. Tienes nuestro blog que explica nuestra idea de proyecto (https://studateapp.blogspot.com/). Ahora me gustaría que me recomendaras un modelo que cumpla con los siguientes requisitos: nuevo modelo con relación a una entidad existente que no sea user. Ha de contener un vector de objetos (subdocumentos) con al menos 3 tipos de datos distintos. Primero decidimos este modelo y una vez lo tengamos claro procederemos a hacer el feat, que lo llamaremos por el nombre del modelo escogido. Y para que no haya dudas, solo trabajaremos dentro del backoffice.»
- **Incoherencias:** el blog no habla de un rol admin: el Plan lo cierran los dos usuarios desde la app. Aquí el que lo gestiona es el admin, desde el backoffice.
- **Solución:** elegimos el modelo `Plan`, que en el blog es el "Cambio de Aula". Va relacionado con `Date` (un Plan por Date) y tiene un vector `spins` con las tiradas de la ruleta: `place` (String), `walkingMinutes` (Number), `scheduledAt` (Date) y `accepted` (Boolean).

### 3. Requisitos totales y plan por feats

- **Pregunta:** qué hay que hacer en total con `Plan` y cómo dividirlo en feats, separando backend y frontend.
- **Prompt:** «Una vez tengamos el modelo Plan (usemos su nombre en inglés) hay que hacer su CRUD completo (hard delete y soft delete incluidos) más lo que sea necesario para realizar el mínimo 1. Hay que hacer la paginación desde el servidor, usando populate en MongoDB para las relaciones. Esto tiene que poder filtrarse con al menos 2 combinaciones a la misma ruta de la lista (uno de texto y otro que sea necesario, que no sea texto). Por supuesto esto tiene que estar correctamente validado con Joi, usando los 400, 422, 404, 409. Ya en el frontend tenemos que añadir un Service nuevo que concentre todas las peticiones. Necesitamos 2 nuevos componentes standalone (lista y formulario/detalles) integrados en una vista existente de la entidad relacionada. Usaremos 3 llamadas del nuevo endpoint, obligatoriamente el listado paginado (paginación de servidor + cerca). Cuando hagamos la parte visual quiero un mockup, un HTML que guardarás en el repo de frontend para ver cómo quedará la página modificada. Dime el plan de acción dividido en feats y qué pertenece al backend y qué al frontend.»
- **Incoherencias:** la vista de Dates la usan el admin y los usuarios normales (la ruta solo tiene `authGuard`), así que los componentes de Plan no pueden ir protegidos por la ruta. Además, borrar un Date para siempre dejaría su Plan huérfano.
- **Solución:** tres feats en el backend (`feat/plan-model`, `feat/plan-list`, `feat/plan-crud`) y cuatro en el frontend (`feat/plan-mockup`, `feat/plan-service`, `feat/plan-list`, `feat/plan-form`). Los componentes van dentro de la vista de Dates, solo con `isAdmin()`, y la API responde 403 a cualquier rol que no sea admin. Al borrar un Date se borra también su Plan.

### 4. B1: modelo Plan (`feat/plan-model`)

- **Pregunta:** cómo es el modelo `Plan`, su validación con Joi y sus datos de ejemplo.
- **Prompt:** «Me parece bien la división. Por cada feat quiero ver el código nuevo que vas a añadir, así validando tu plan de acción por cada feat con mi ok. Para el feat 3 te pediré el mockup HTML que te he mencionado previamente. Venga, empezamos con el B1, dime cuál es el plan de acción (recuerda que quiero ver el código que vamos a implementar).»
- **Incoherencias:** ninguna en el código. Antes de proponerla comprobamos que la regla custom de Joi ("una sola tirada aceptada") da un error con `details`, que el ErrorHandler responde como 422. El permiso de Claude Code bloqueó `npm run seed -- --reset` porque borra la BD, así que lo lancé yo a mano.
- **Solución:** `src/models/Plan.ts` con el subdocumento `Spin` (String, Number, Date, Boolean), los esquemas Joi `plan.create`, `plan.update` y `planList`, y Planes de ejemplo en el seed.

### 5. B2: listado paginado y detalle de Planes (`feat/plan-list`)

- **Pregunta:** cómo listar los Planes paginados desde el servidor, con populate y filtros combinables, solo para admin.
- **Prompt:** «Ya está hecho. Comprueba que está bien, haz los commits, cierras el feat y procedemos al siguiente feat donde me dirás el plan de acción.»
- **Incoherencias:** la búsqueda con regex no ignora los acentos: "cafeteria" no encuentra "Cafetería" (sí lo encuentra "cafe").
- **Solución:** `PlanService.getPlans` hace `find` + populate anidado (Plan, luego Date, luego los dos usuarios) + `skip`/`limit` + `countDocuments`. Los filtros `search`, `status`, `date` y `archived` se combinan en `GET /plans`, y `GET /plans/:planId` devuelve el detalle. Las dos rutas llevan `VerifyToken` + `RequireRole('admin')`.

### 6. B3: CRUD de Planes (`feat/plan-crud`)

- **Pregunta:** cómo crear, editar, archivar, restaurar y eliminar Planes con los códigos 404 y 409 correctos, solo para admin.
- **Prompt:** «Procede, tienes mi ok» (cierre de B2, junto al que Claude propuso el plan de B3) y «OK» (aprobación del plan de B3).
- **Incoherencias:** el borrado físico de un Date dejaba su Plan huérfano: el populate habría devuelto `date: null`. En las pruebas, un `POST /plans` sin body daba 500: Express 5 deja `req.body` en `undefined` y Joi lo da por bueno aunque haya campos `required`. El fallo venía de antes y también afectaba a `POST /grades` y `POST /dates`.
- **Solución:** `PlanService` devuelve `{ error }` y el controlador lo traduce a 404 o 409 con una tabla de mensajes. El Plan se edita con `save()` para que pasen los validadores del modelo. El hard delete solo se permite si el Plan está archivado, y `DateService.deleteDate` elimina también el Plan del Date. `ValidateJoi` valida `req.body ?? {}`, así que una petición sin body responde 422.

### 7. F1: mockup de la vista de Dates con los Planes (`feat/plan-mockup`)

- **Pregunta:** cómo quedará la vista de Dates del admin con los dos componentes nuevos de Plan.
- **Prompt:** «Seed reseteado. Vale, pues entonces móntame ya el mockup de la página que vamos a modificar, así te valido si me parece bien el resultado final.»
- **Incoherencias:** para enseñar en la tabla de Dates qué Date tiene Plan habría que pedir los Planes de cada fila, una petición por Date.
- **Solución:** `mockups/plan-dates.html`, un HTML estático con los estilos y los datos reales del seed. El botón "Plan" de cada Date filtra la lista de Planes por ese Date (`GET /plans?date=`), así que basta con una sola llamada. Los Planes salen en una sección nueva debajo de los Dates (`app-plans-list`), y el formulario y detalle (`app-plan-form`) se abre como panel en la misma vista. Todo solo para el admin.

### 8. F2: modelo y PlanService del frontend (`feat/plan-service`)

- **Pregunta:** cómo concentrar en un solo servicio todas las peticiones a `/plans`.
- **Prompt:** «Tienes mi visto bueno del resultado final, procede.» (validación del mockup; Claude cierra F1 y propone el plan de F2)
- **Incoherencias:** al editar, las tiradas llegan de la API con su `_id`, pero el esquema Joi de la tirada no lo acepta (422). Antes de enviarlas hay que quitarlo.
- **Solución:** `models/plan.model.ts` con los tipos del Plan tal como llega con el populate y el tipo `SpinInput` (la tirada sin `_id`). `services/plan.service.ts` con las 7 llamadas: listado con `search`, `status`, `date` y `archived`, detalle, crear, editar, archivar, restaurar y eliminar. Lleva su spec de Vitest.

### 9. F3: lista de Planes en la vista de Dates (`feat/plan-list`)

- **Pregunta:** cómo integrar un componente standalone con la lista paginada de Planes en la vista de Dates, solo para el admin.
- **Prompt:** «procede» (aprobación de F2; Claude cierra F2 y propone el plan de F3)
- **Incoherencias:** en el mockup, el botón "Plan" de un Date con el Plan archivado saltaba solo a "Archivados". Con datos reales, la API filtra siempre por `archived` y no se sabe de antemano si ese Date tiene el Plan archivado. Además, el spec de `DatesList` del admin fallaría con la petición nueva a `/plans` si no se actualiza.
- **Solución:** `components/plans-list` (standalone) con el buscador, el estado y Activos/Archivados combinados en `GET /plans`, paginación de servidor, populate de la pareja, y archivar, restaurar y eliminar con `confirm-modal`. `DatesList` lo muestra solo si `isAdmin()` y su botón "Plan" le pasa el Date con un `input()`. Si ese Date no tiene un Plan activo, la lista lo dice y avisa de que puede estar en "Archivados".

### 10. F4: formulario y detalle de un Plan (`feat/plan-form`)

- **Pregunta:** cómo crear, editar y ver un Plan con un componente standalone de formulario y detalle, con las tiradas como lista dinámica.
- **Prompt:** «procede» (aprobación de F3; Claude implementa F3, la prueba contra la API real y propone el plan de F4)
- **Incoherencias:** en la prueba real de F3, la barra de filtros heredaba el `justify-content: space-between` global y separaba los controles (lo corregimos). Para F4: el `<input type="datetime-local">` trabaja en hora local sin zona y la API guarda ISO en UTC, así que hay que convertir en los dos sentidos. Además, al editar las tiradas llegan con `_id` y Joi no lo acepta. En la prueba real, al eliminar un Date la lista de Planes seguía mostrando su Plan (que la API ya había borrado en cascada) porque `DatesList` no avisaba a `PlansList`.
- **Solución:** `components/plan-form` (standalone) con formulario reactivo: `FormArray` de tiradas (de 1 a 3) y un validador de grupo con las mismas reglas que Joi (una sola aceptada; confirmado con aceptada). Pide el detalle con `GET /plans/:id`, crea con `POST` y edita con `PUT` enviando `SpinInput` sin `_id`. Un Plan archivado se ve en solo lectura. `plans-list` lo abre con "Nuevo Plan", "Editar" y "Ver", y recarga la página al guardar. Al eliminar un Date, `DatesList` quita el filtro de ese Date o recarga la lista de Planes (con `viewChild`).

### 11. Formato de Prettier en dates-list (`fix/dates-list-format`)

- **Pregunta:** dejar con el formato de Prettier los ficheros de la vista de Dates que hemos tocado.
- **Prompt:** «Arregla lo del formato como un fix.»
- **Incoherencias:** en el frontend había 22 ficheros que ya no cumplían Prettier antes del examen. Solo 3 (los de `dates-list`) se han tocado en el Mínimo 1.
- **Solución:** `prettier --write` solo en `dates-list.ts`, `.html` y `.spec.ts`, en su propia rama de fix. Comprobamos que, quitando espacios, saltos de línea y comas finales, el contenido es idéntico (solo cambia el formato). Los tests, el lint y el build siguen igual. Los otros 19 ficheros no se tocan para no mezclar cambios ajenos al examen.

# Sprint 2

Modelo en el Sprint 2: Claude Fable 5.2.

### 1. Estructura: la sesión, los modelos y la paginación (`feat/estructura`)

- **Pregunta:** cómo dejar el backend preparado para la web en React, la web en Docker y la app del móvil, con todos los modelos del sprint ya creados.
- **Prompt:** «Según la planificación establecida previamente, vamos a proceder de esta forma. Empezamos por la estructura, que es la base de todo. Las tareas son las del bloque 1 del plan (de la 1 a la 15). Primero el backend. Hay que dejar la sesión preparada para la web en local, la web en Docker y el móvil: CORS con varios orígenes, la cookie del refresh configurable para poder servir la API detrás de /api, y el refresh token también en el body para el móvil, sin quitar la cookie de la web. Además hay que crear ya todos los modelos (User, Grade, Date, Plan, Message, Block, Report y SafetyAlert) con los campos nuevos que tenemos en el plan de la base de datos, porque son la base de todo lo demás. La paginación del servidor pasa a 10 por página: 5 se queda muy corto. Y todo tiene que ir seguro con JSON Web Token: solo el registro y el login (y el refresh y el logout) van sin token, y la protección se pone en las rutas, como le gusta al profesor. [...] Las cosas se hacen por feats: una rama por grupo de tareas, como en el Mínimo 1, y un commit por tarea. Dime el plan de acción.» Después de ver el plan y los ajustes que proponía Claude, lo aprobamos tal cual («procede»), le dimos permiso para rehacer el seed y la base de datos local, y le pedimos que, si salía alguna incompatibilidad que no hubiéramos tenido en cuenta, la dejara bien resuelta pensando en el futuro.
- **Incoherencias:**
  - El plan hablaba del rol "student", pero el backend y el plan de la base de datos usan `user` y `admin`.
  - El plan decía que el refresh leyera la cookie y, si no había, el body. Un teléfono también guarda cookies: con ese orden, la cookie de una sesión anterior podía renovar la cuenta equivocada.
  - Los contactos de confianza son datos de terceras personas y habrían salido en todos los listados de usuarios.
  - Al eliminar un usuario para siempre se borraban sus Dates, pero no los Planes de esos Dates, que se quedaban huérfanos. Venía del Mínimo 1.
  - Los modelos nuevos todavía no tienen rutas, así que el servidor no los importa: sin hacer nada, sus colecciones y sus índices no se habrían creado.
- **Solución:**
  - El rol sigue siendo `user`; "estudiante" es solo el nombre que se verá en pantalla.
  - `CORS_ORIGINS` con una lista de orígenes, y `REFRESH_COOKIE_PATH` y `COOKIE_SECURE` para la cookie. Con la cabecera `X-Client: movil`, el login devuelve el refresh token en el JSON y no pone cookie; en `/auth/refresh` manda el body sobre la cookie. La web no cambia.
  - `Message`, `Block`, `Report` y `SafetyAlert` con sus índices y sus esquemas de Joi. `trustedContacts` con `select: false`. `Date` con `startedAt`, `closedAt`, `closedReason` e `history`, que empieza con la entrada `pending` al abrirse.
  - Paginación de 10 con una sola constante (`PAGE_SIZE`).
  - Un `fix` aparte para el borrado: con cada Date se borran su Plan y sus mensajes, y con el usuario, sus bloqueos, partes y alertas.
  - El seed importa los modelos nuevos, espera a sus índices con `init()` y crea datos de ejemplo de todo. Swagger documenta los esquemas nuevos y los dos modos del refresh.

### 2. Primer despliegue en Docker: la imagen de la API (`feat/docker`)

- **Pregunta:** cómo meter la API en una imagen de Docker que sirva igual en local y en el servidor, a partir del Seminario 10.
- **Prompt:** «Según la planificación establecida previamente, vamos a proceder de esta forma. Con la estructura hecha y el login funcionando, toca el primer despliegue en Docker (bloque 2 del plan, de la 16 a la 19). Lo hacemos ya, con poco dentro, para ver si hay problemas con el servidor y no dejarlo para el final. Se hace como en el Seminario 10: te paso los repos del seminario y los datos del servidor. La conexión tiene que ir por HTTPS. A simple vista, con lo que tenemos del Seminario 10 ya tendríamos todo; si consideras que falta algo, me lo comentas. La contraseña no se escribe en ningún sitio. Hace falta el Dockerfile de la API, el de la web servida con nginx y el docker compose con MongoDB, la API y la web en el repo de despliegue. Primero que funcione en local y después en el servidor, y al final probar desde fuera que se puede iniciar sesión. Dime el plan de acción.» Después del análisis del Seminario 10: «Continúa con la parte local» mientras se consiguen los datos del servidor.
- **Incoherencias:**
  - En el Seminario 10 el seed no va en la imagen porque se ejecuta con `tsx` (dependencia de desarrollo): para llenar la base de datos del servidor hay que tener el código allí.
  - Al arrancar, `server.ts` no termina el proceso si MongoDB no responde: el contenedor se quedaría vivo sin servidor. Con el `healthcheck` de MongoDB en el compose y los 30 segundos de reintento de Mongoose no llega a pasar, así que no se ha tocado.
- **Solución:**
  - `Dockerfile` en dos etapas con `node:24-alpine`: la primera compila y la segunda se queda con `build/` y las dependencias de producción, sin código fuente ni `.env`, y corre como el usuario `node`. `.dockerignore` deja fuera `node_modules`, `build`, `.git` y cualquier `.env`.
  - El seed se compila con el resto (`build/seed.js`) y se ejecuta dentro del contenedor con `node`, sin `tsx`.
  - Un workflow de GitHub Actions pasa lint y build y publica la imagen en ghcr.io (`latest` desde `main`, `develop` desde `develop`).
  - Probado en local: `docker build`, el seed contra un MongoDB en una red de Docker sin puerto público, y el login con la cookie en `/api/auth` (la ruta que tendrá detrás de nginx).

### 3. La Orla del estudiante (`feat/orla`)

- **Pregunta:** cómo montar La Orla en el backend: el siguiente Expediente, votar con el A+ mutuo que abre el Date, el cupo de 30 A+ al día y deshacer en 10 segundos.
- **Prompt:** «Según la planificación establecida previamente, vamos a proceder de esta forma. Ahora la pantalla principal de Studate, La Orla (bloque 3 del plan, de la 20 a la 25). Recuerda que esto es como un Tinder, pero para estudiantes: te sale el Expediente de alguien y le pones A+ o F. Primero el backend: el siguiente perfil (que no sea yo, que no lo haya votado y sin bloqueos entre los dos), votar, el A+ mutuo que abre el Date, el cupo de 30 A+ al día y deshacer en 10 segundos. Todo con JSON Web Token, como el resto. [...] Dime el plan de acción.» Tras ver el plan, Diego lo aprobó para proceder con el backend.
- **Incoherencias:**
  - El `/grades` que ya existía es el CRUD del backoffice (solo admin). La Orla es el flujo del estudiante y necesita otras reglas (el `from` del token, el cupo, el bloqueo), así que no encajaba en `/grades`.
  - `GradeService.createGrade` ya abría el Date, pero descarta el Date que devuelve y acepta usuarios inactivos (el admin puede). La Orla necesita el Date en la respuesta y solo estudiantes activos.
- **Solución:**
  - Un router nuevo `/orla` (rol `user`) con `OrlaService`: `getNext` (excluye al propio usuario, a los ya votados y a los bloqueados en los dos sentidos, y añade el cupo restante), `vote` (reutiliza `openDateIfMutual` y devuelve el Date) y `undo`.
  - Cupo de 30 A+ por día natural con el índice `(from, value, createdAt)` en Grade; las F no cuentan. Deshacer solo un voto propio de menos de 10 s, borrando también el Date que ese A+ hubiera abierto.
  - Joi del body del voto, Swagger con el tag Orla, y 23 pruebas con `fetch` contra la API local, todas en verde.

### 4. Mi perfil (`feat/perfil`)

- **Pregunta:** cómo dejar que el estudiante edite su perfil, su foto y sus contactos de confianza sin poder cambiarse el rol.
- **Prompt:** «Según la planificación establecida previamente, vamos a proceder de esta forma. Ahora Mi perfil (bloque 4 del plan, de la 26 a la 28). Es lo mismo que en cualquier web que tiene un "mi perfil": tu zona de ajustes, pero personales. El estudiante edita su Expediente y su foto, pero no puede cambiarse el rol. Recuerda que de momento solo existen dos roles, administrador y estudiante; nada más por ahora. Aquí van también los contactos de confianza, y tienen que ser opcionales: no hay que obligar a nadie a ponerlos. Mismo estilo visual y mismo CSS global que el resto. Primero el backend y después la web. Dime el plan de acción.»
- **Incoherencias:**
  - `GET /users/me` solo devolvía `_id`, `name`, `email` y `role`: no servía para rellenar la pantalla de Mi perfil.
  - Los contactos de confianza tienen `select: false` (son datos de terceras personas): había que decidir dónde se ven. Solo en `GET /users/me`, para su dueño.
  - `VerifyToken` consulta el usuario en cada petición: no conviene cargarle el perfil entero y los contactos cada vez.
- **Solución:**
  - `getMe` (perfil completo con `+trustedContacts`) separado de `getUserById` (ligero, el de `VerifyToken`). `PUT /users/me` con `updateMe` y `findOneAndUpdate` con `runValidators`.
  - El esquema `user.updateMe` reutiliza los campos del perfil y deja fuera `email`, `role` y `active`: enviar `role: 'admin'` responde 422. Los contactos, como lista opcional de hasta 3 (`[]` los quita).
  - Swagger con `MyProfileInput` y la ruta PUT documentada; contrato y bitácora en LOGS.

### 5. Mis Dates y chat (`feat/chat`)

- **Pregunta:** cómo montar el chat de los Dates en tiempo real con socket.io, con el JWT también en el socket, y que todo quede registrado: los mensajes y cada cambio de estado del Date, con quién y cuándo.
- **Prompt:** «Según la planificación establecida previamente, vamos a proceder de esta forma. Toca montar lo de las citas: Mis Dates y el chat (bloque 5 del plan, de la 29 a la 33). Aquí es donde volvemos a usar socket.io, y como es un chat, tiene que ser en tiempo real. Usa bien JSON Web Token también en el socket: sin token no se conecta nadie. Usa los modelos nuevos que ya creamos en la estructura, adaptados a lo que queremos montar. Y todo tiene que quedar bien registrado con su historial: los mensajes y los movimientos de cada Date, es decir, cada cambio de estado con quién lo hizo y cuándo. Primero el backend y después la web, con el estilo y el CSS global de siempre. Dime el plan de acción.» Diego pidió que se hicieran todos los bloques seguidos sin parar en cada uno, preguntando solo si surgía algo.
- **Incoherencias:**
  - El chat del Seminario 10 tiene salas con nombre (`general`, `group:`, `direct:`) y el historial va por el propio socket. En Studate la sala es el Date y el historial tiene que ser paginado, así que el historial va por HTTP y el socket solo lleva lo que pasa ahora.
  - El middleware del socket del seminario rechaza todo con un `Authentication error` genérico; con eso el frontend no sabe si le basta con renovar el token.
  - `POST /dates` y `PUT /dates/:dateId` dejaban a un estudiante abrir y cambiar Dates a mano, y `updateStatus` cambiaba el estado sin apuntar nada en el `history`. El plan dice "estados automáticos y sin Dates a mano".
  - El cierre por caducidad estaba previsto en el modelo (índice `(status, expiresAt)` y `closedReason: 'expired'`) pero nadie lo ejecutaba.
  - La prórroga no es un cambio de estado, pero sí un movimiento del Date que hay que registrar.
- **Solución:**
  - `VerifySocketToken` lee el token del handshake y responde con los mismos mensajes que el 401 de la API; comprueba también que el usuario siga activo, como `VerifyToken`.
  - `ChatService` con las reglas (solo los dos del Date, turno de `firstTurn` mientras está pendiente, nada en un Date cerrado) y `sockets/Chat.ts` con los eventos `date:join`, `date:message`, `date:read`, `date:updated` y `chat:error`; el texto se valida con el mismo Joi que una ruta.
  - `GET /dates/:dateId/messages` paginado (página 1, los más nuevos). `POST` y `PUT /dates` solo admin; `updateStatus`, `extendDate`, el primer mensaje y el cierre por caducidad escriben en el `history` con `by`, `reason` y `at`. `jobs/ExpireDates.ts` cierra los pendientes caducados cada minuto y avisa a la sala.
  - README con la tabla de eventos del socket, contrato en LOGS y 56 comprobaciones con `fetch` y `socket.io-client`.

### 6. Seguridad (`feat/seguridad`)

- **Pregunta:** cómo montar la conciencia digital en el backend: bloquear, mandar un parte al admin y el botón de ayuda con los contactos de confianza opcionales.
- **Prompt:** «Según la planificación establecida previamente, vamos a proceder de esta forma. Ahora las funcionalidades de conciencia digital, la seguridad (bloque 6 del plan, de la 34 a la 38). Bloquear: si alguien te da mala espina, lo bloqueas y ya no vuelve a aparecer, ni en La Orla ni en los chats. Reportar: de momento el parte va al administrador, y el administrador, según la gravedad, ya verá cómo actuar. A futuro esto se podría automatizar o conectar con otros sistemas, como la policía, pero ahí hay que ir con mucho cuidado; de momento, solo al administrador. Y el botón de ayuda con los contactos de confianza, que son opcionales: no se obliga a nadie a tenerlos, y si no hay, el aviso llega igualmente a los administradores. Primero el backend y después la web. Dime el plan de acción.» Diego pidió que se hicieran todos los bloques seguidos sin parar en cada uno, preguntando solo si surgía algo.
- **Incoherencias:**
  - "Ya no vuelve a aparecer en los chats" no está resuelto con solo guardar el bloqueo: el Date que tienen los dos seguiría abierto. Se decidió que bloquear cierra el Date (`closedReason: 'blocked'`, que el modelo ya tenía previsto) y que desbloquear no lo reabre.
  - Un parte o una alerta pueden llevar el Date desde el que se mandan; si no se comprueba, cualquiera podría colgarlos de un Date ajeno.
  - "Avisar a los contactos de confianza" no tiene un servicio de correo real en el proyecto: se simula en el log del servidor, como ya hacía el email de bienvenida.
  - Los admin tienen que recibir la alerta "al momento": hacía falta una sala del socket solo para ellos, que no existía.
- **Solución:**
  - `BlockService` (bloquear cierra el Date y avisa a su sala; desbloquear; `isBlockedBetween`), `ReportService` (crear con el Date comprobado, listar con filtros, revisar con gravedad, resolución, quién y cuándo) y `SafetyAlertService` (crear con el Date o Plan comprobado, avisar a los contactos, listar, atender).
  - Sala `admins` en el socket: los sockets con rol `admin` entran al conectar y reciben `alert:new` y `alert:updated` (`emitToAdmins`).
  - Rutas `/blocks`, `/reports` y `/alerts` con sus roles (mandar es del estudiante, ver y revisar del admin), Joi para los filtros nuevos, Swagger con tres tags, contrato en LOGS y 43 comprobaciones con `fetch` y `socket.io-client`.

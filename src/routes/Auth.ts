import express from 'express';

import controller from '../controllers/Auth';

import { Schemas, ValidateJoi } from '../middleware/Joi';

// Rutas de autenticacion. Son las unicas publicas: no piden access token. Refresh y logout trabajan con
// la cookie HttpOnly del refresh token, que el navegador envia solo a estas rutas (path=/auth). La app
// del movil no tiene cookie y manda el refresh token en el body de /auth/refresh.
// Register, login y refresh validan el body con Joi; logout no tiene body.
const router = express.Router();
router.post('/register', ValidateJoi(Schemas.auth.register), controller.register);
router.post('/login', ValidateJoi(Schemas.auth.login), controller.login);
router.post('/refresh', ValidateJoi(Schemas.auth.refresh), controller.refresh);
router.post('/logout', controller.logout);
export = router;

// Documentacion de Swagger de las cuatro rutas.
// security: [] quita el candado: son las unicas rutas que no necesitan access token.

/**
 * @openapi
 * /auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registra un usuario nuevo
 *     description: El usuario se crea siempre con el rol user. No devuelve token, hay que hacer login despues.
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RegisterInput' }
 *     responses:
 *       201:
 *         description: Usuario creado
 *         content:
 *           application/json:
 *             schema: { type: object, properties: { user: { $ref: '#/components/schemas/User' } } }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *
 * /auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Inicia sesion
 *     description: >
 *       Devuelve el access token (para la cabecera Authorization) y el usuario. En la web el refresh token no va
 *       en el JSON: se deja en la cookie HttpOnly `refreshToken` (SameSite=Strict, Path=/auth, 7 dias; Secure en
 *       produccion). La app del movil manda la cabecera `X-Client: movil` y entonces lo recibe en el JSON
 *       (`refreshToken`) y no se pone cookie. Un usuario inactivo o archivado recibe 401, con el mismo mensaje que
 *       una contraseña incorrecta.
 *     security: []
 *     parameters:
 *       - in: header
 *         name: X-Client
 *         required: false
 *         schema: { type: string, enum: [movil] }
 *         description: Solo la app del movil. Con `movil`, el refresh token va en el JSON en lugar de en la cookie.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/LoginOk' }
 *       401: { $ref: '#/components/responses/BadCredentials' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *
 * /auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Pide un access token nuevo
 *     description: >
 *       Se usa cuando el access token ha caducado. Hay dos modos. La web no manda body: se lee el refresh token de
 *       la cookie que dejo el login. La app del movil manda `{ refreshToken }` en el body. Si llegan los dos, se
 *       usa el del body.
 *     security: [{ refreshCookie: [] }, {}]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/RefreshInput' }
 *     responses:
 *       200:
 *         description: Access token nuevo
 *         content:
 *           application/json:
 *             example: { token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 *
 * /auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cierra la sesion
 *     description: >
 *       Borra la cookie del refresh token. Despues, /auth/refresh responde 401 hasta que se vuelva a hacer login.
 *       La app del movil no tiene cookie: cierra sesion borrando el refresh token que guarda ella.
 *     security: [{ refreshCookie: [] }]
 *     responses:
 *       204:
 *         description: Cookie borrada
 */

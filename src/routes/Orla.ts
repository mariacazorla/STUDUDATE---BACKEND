import express from 'express';

import controller from '../controllers/Orla';

import { Schemas, ValidateId, ValidateJoi } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';
import { VerifyToken } from '../middleware/VerifyToken';

// Rutas de La Orla: el flujo del estudiante. Todas piden sesion (VerifyToken) y rol 'user'
// (RequireRole('user')): el admin no vota, usa el backoffice. El que vota sale siempre del token,
// nunca del body, asi que nadie puede votar ni deshacer en nombre de otro.
const router = express.Router();

/**
 * @openapi
 * /orla/next:
 *   get:
 *     tags: [Orla]
 *     summary: El siguiente Expediente para votar
 *     description: >
 *       Un estudiante activo, que no soy yo, al que no he votado y sin bloqueo entre los dos. Incluye
 *       cuántos A+ me quedan hoy (`remaining`), para no tener que pedirlo aparte. Si no queda nadie,
 *       `user` es `null`.
 *     responses:
 *       200:
 *         description: El Expediente y el cupo del día
 *         content:
 *           application/json:
 *             example:
 *               user: { _id: 6ab3f2fe9c500204a7d5f8a4, name: Pau Ferrer, degree: Grau en Enginyeria Aeroespacial, lookingFor: Compañero de proyecto, bio: Drones y laboratorio., birthDate: '2002-11-03T00:00:00.000Z' }
 *               remaining: 27
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */

// El siguiente Expediente y el cupo del dia
router.get('/next', VerifyToken, RequireRole('user'), controller.next);

/**
 * @openapi
 * /orla/votes:
 *   post:
 *     tags: [Orla]
 *     summary: Votar un Expediente (A+ o F)
 *     description: >
 *       El `from` sale del token. No se puede votar a uno mismo (422), a alguien con quien hay un bloqueo
 *       (403), ni dos veces al mismo perfil (409). Si es A+ y el otro ya me había dado A+, se abre el Date
 *       y la respuesta lo incluye en `date`.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/OrlaVoteInput' }
 *     responses:
 *       201:
 *         description: Voto creado (con el Date si se ha formado un A+ mutuo)
 *         content:
 *           application/json:
 *             example:
 *               grade: { _id: 6ab3f2fe9c500204a7d5f901, from: { _id: 6ab3f2fe9c500204a7d5f8a3, name: Laia Puig }, to: { _id: 6ab3f2fe9c500204a7d5f8a4, name: Pau Ferrer }, value: 'A+' }
 *               date: null
 *               remaining: 26
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Votar un Expediente
router.post('/votes', VerifyToken, RequireRole('user'), ValidateJoi(Schemas.orla.vote), controller.vote);

/**
 * @openapi
 * /orla/votes/{gradeId}:
 *   delete:
 *     tags: [Orla]
 *     summary: Deshacer mi último voto (10 s)
 *     description: >
 *       Borra un voto propio si tiene menos de 10 segundos; pasados, 409. Solo se puede deshacer un voto
 *       propio (el de otro da 404). Si ese A+ había abierto un Date, el Date se borra también.
 *     parameters:
 *       - in: path
 *         name: gradeId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200:
 *         description: Voto deshecho
 *         content:
 *           application/json:
 *             example: { dateRemoved: false, remaining: 27 }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/Conflict' }
 */

// Deshacer mi ultimo voto
router.delete('/votes/:gradeId', VerifyToken, RequireRole('user'), ValidateId('gradeId'), controller.undo);

export = router;

import express from 'express';

import controller from '../controllers/Orla';

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

export = router;

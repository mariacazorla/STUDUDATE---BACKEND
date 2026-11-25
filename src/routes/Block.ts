import express from 'express';

import controller from '../controllers/Block';

import { Schemas, ValidateId, ValidateJoi } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';
import { VerifyToken } from '../middleware/VerifyToken';

// Rutas de los bloqueos: el flujo del estudiante (rol 'user'). El que bloquea sale siempre del token.
// A la persona bloqueada no se le avisa, y no hay ninguna ruta con la que pueda saber quien la bloqueo.
const router = express.Router();

/**
 * @openapi
 * /blocks:
 *   get:
 *     tags: [Blocks]
 *     summary: A quién he bloqueado
 *     responses:
 *       200: { $ref: '#/components/responses/BlockList' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */

// Mis bloqueos
router.get('/', VerifyToken, RequireRole('user'), controller.readMine);

/**
 * @openapi
 * /blocks:
 *   post:
 *     tags: [Blocks]
 *     summary: Bloquear a alguien
 *     description: >
 *       Desde ese momento ninguno de los dos le sale al otro en La Orla ni en los chats. Si tenían un Date abierto,
 *       se cierra (`closedReason: blocked`, con el bloqueo en su historial) y la sala del chat recibe `date:updated`.
 *       A la persona bloqueada no se le avisa.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/BlockInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/BlockOne' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/AlreadyBlocked' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Bloquear
router.post('/', VerifyToken, RequireRole('user'), ValidateJoi(Schemas.block.create), controller.create);

/**
 * @openapi
 * /blocks/{userId}:
 *   delete:
 *     tags: [Blocks]
 *     summary: Quitar un bloqueo mío
 *     description: El Date que se cerró con el bloqueo no se reabre.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       204:
 *         description: Bloqueo quitado
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Desbloquear
router.delete('/:userId', VerifyToken, RequireRole('user'), ValidateId('userId'), controller.remove);

export = router;

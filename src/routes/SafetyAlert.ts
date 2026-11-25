import express from 'express';

import controller from '../controllers/SafetyAlert';

import { Schemas, ValidateAlertList, ValidateId, ValidateJoi } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';
import { VerifyToken } from '../middleware/VerifyToken';

// Rutas del boton de ayuda. Pedir ayuda es del estudiante (rol 'user'); ver y atender las alertas, solo
// del admin, que ademas las recibe al momento por el socket (eventos alert:new y alert:updated).
const router = express.Router();

/**
 * @openapi
 * /alerts:
 *   post:
 *     tags: [Alerts]
 *     summary: Pedir ayuda (el botón de ayuda)
 *     description: >
 *       Crea una alerta abierta, la manda al momento a los admin conectados (evento `alert:new` del socket) y avisa a
 *       los contactos de confianza del usuario, si los tiene (son opcionales: sin ellos, la alerta se crea igual).
 *       `date` o `plan` dicen desde dónde se pide, para saber con quién estaba; tienen que ser suyos (422 si no).
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SafetyAlertInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/AlertCreated' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Pedir ayuda
router.post('/', VerifyToken, RequireRole('user'), ValidateJoi(Schemas.safetyAlert.create), controller.create);

/**
 * @openapi
 * /alerts:
 *   get:
 *     tags: [Alerts]
 *     summary: Lista las alertas (solo admin)
 *     description: Primero las más nuevas. Las abiertas son las que hay que atender.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, attended, false_alarm] }
 *     responses:
 *       200: { $ref: '#/components/responses/AlertList' }
 *       400: { $ref: '#/components/responses/InvalidPagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */

// La lista de alertas del backoffice
router.get('/', VerifyToken, RequireRole('admin'), ValidateAlertList, controller.readAll);

/**
 * @openapi
 * /alerts/{alertId}:
 *   get:
 *     tags: [Alerts]
 *     summary: Devuelve una alerta (solo admin)
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200: { $ref: '#/components/responses/AlertOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Una alerta
router.get('/:alertId', VerifyToken, RequireRole('admin'), ValidateId('alertId'), controller.readOne);

/**
 * @openapi
 * /alerts/{alertId}/attend:
 *   put:
 *     tags: [Alerts]
 *     summary: Atiende una alerta (solo admin)
 *     description: La deja como atendida o falsa alarma. Queda guardado qué admin la atendió y cuándo.
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/SafetyAlertAttendInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/AlertOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Atender una alerta
router.put('/:alertId/attend', VerifyToken, RequireRole('admin'), ValidateId('alertId'), ValidateJoi(Schemas.safetyAlert.attend), controller.attend);

export = router;

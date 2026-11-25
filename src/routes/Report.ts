import express from 'express';

import controller from '../controllers/Report';

import { Schemas, ValidateId, ValidateJoi, ValidateReportList } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';
import { VerifyToken } from '../middleware/VerifyToken';

// Rutas de los partes. Mandarlo es del estudiante (rol 'user'); verlos y revisarlos, solo del admin.
// Un estudiante que pida la lista recibe 403: nunca ve los partes, ni los suyos ni los de otros.
const router = express.Router();

/**
 * @openapi
 * /reports:
 *   post:
 *     tags: [Reports]
 *     summary: Mandar un parte sobre alguien
 *     description: >
 *       Queda abierto hasta que un admin lo revisa. Si se manda desde un chat, `date` es ese Date (tiene que ser
 *       mío y con esa persona). Quien lo manda sale del token.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReportInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/ReportOne' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Mandar un parte
router.post('/', VerifyToken, RequireRole('user'), ValidateJoi(Schemas.report.create), controller.create);

/**
 * @openapi
 * /reports:
 *   get:
 *     tags: [Reports]
 *     summary: Lista los partes (solo admin)
 *     description: Primero los más nuevos. Los abiertos son los que hay que mirar.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [open, reviewed, dismissed] }
 *       - in: query
 *         name: severity
 *         schema: { type: string, enum: [low, medium, high] }
 *       - in: query
 *         name: reported
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *         description: Solo los partes sobre este usuario
 *     responses:
 *       200: { $ref: '#/components/responses/ReportList' }
 *       400: { $ref: '#/components/responses/InvalidPagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 */

// La lista de partes del backoffice
router.get('/', VerifyToken, RequireRole('admin'), ValidateReportList, controller.readAll);

/**
 * @openapi
 * /reports/{reportId}:
 *   get:
 *     tags: [Reports]
 *     summary: Devuelve un parte (solo admin)
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200: { $ref: '#/components/responses/ReportOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Un parte
router.get('/:reportId', VerifyToken, RequireRole('admin'), ValidateId('reportId'), controller.readOne);

/**
 * @openapi
 * /reports/{reportId}/review:
 *   put:
 *     tags: [Reports]
 *     summary: Revisa un parte (solo admin)
 *     description: >
 *       Lo deja como revisado o descartado, con la gravedad y lo que se ha hecho. Queda guardado qué admin lo
 *       revisó y cuándo. No se puede volver a dejar abierto.
 *     parameters:
 *       - in: path
 *         name: reportId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/ReportReviewInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/ReportOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Revisar un parte
router.put('/:reportId/review', VerifyToken, RequireRole('admin'), ValidateId('reportId'), ValidateJoi(Schemas.report.review), controller.review);

export = router;

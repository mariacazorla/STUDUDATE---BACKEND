import express from 'express';

import controller from '../controllers/Date';

import { Schemas, ValidateDateList, ValidateId, ValidateJoi, ValidatePagination } from '../middleware/Joi';
import { RequireRole } from '../middleware/RequireRole';
import { VerifyToken } from '../middleware/VerifyToken';

// Rutas de los Dates. Cualquier usuario con sesion ve sus propios Dates, lee su chat y pide la prorroga
// (el service filtra por req.user). Abrir un Date a mano, cambiarlo de estado y eliminarlo es solo del
// admin: para los estudiantes, los Dates se abren con el A+ mutuo de La Orla y cambian de estado solos.
const router = express.Router();

/**
 * @openapi
 * /dates:
 *   get:
 *     tags: [Dates]
 *     summary: Lista los Dates
 *     description: El admin ve todos; un usuario normal, solo los suyos. Primero los más nuevos.
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [pending, ongoing, closed] }
 *         description: Solo los de esta bandeja
 *       - in: query
 *         name: user
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *         description: Solo los de este usuario (solo para el admin)
 *     responses:
 *       200: { $ref: '#/components/responses/DateList' }
 *       400: { $ref: '#/components/responses/InvalidPagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       500: { $ref: '#/components/responses/ServerError' }
 */

// Ruta para obtener una pagina de Dates
router.get('/', VerifyToken, ValidateDateList, controller.readAll);

/**
 * @openapi
 * /dates/{dateId}:
 *   get:
 *     tags: [Dates]
 *     summary: Devuelve un Date
 *     description: Un usuario normal solo puede ver los suyos (404 si no).
 *     parameters:
 *       - in: path
 *         name: dateId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200: { $ref: '#/components/responses/DateOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Ruta para buscar un Date usando su ID
router.get('/:dateId', VerifyToken, ValidateId('dateId'), controller.readDate);

/**
 * @openapi
 * /dates:
 *   post:
 *     tags: [Dates]
 *     summary: Abre un Date entre dos usuarios a mano (solo admin)
 *     description: >
 *       Se sortea quién escribe primero y caduca en 24 horas. Solo puede haber un Date entre cada pareja (409).
 *       Un estudiante no abre Dates a mano (403): los suyos se abren solos cuando dos usuarios se dan A+ en La Orla.
 *       En el historial queda qué admin lo abrió.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DateInput' }
 *     responses:
 *       201: { $ref: '#/components/responses/DateOne' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/DateConflict' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Ruta para abrir un Date a mano: solo el admin
router.post('/', VerifyToken, RequireRole('admin'), ValidateJoi(Schemas.date.create), controller.createDate);

/**
 * @openapi
 * /dates/{dateId}:
 *   put:
 *     tags: [Dates]
 *     summary: Cambia un Date de bandeja a mano (solo admin)
 *     description: >
 *       El cambio queda en el historial con el admin, la hora y el motivo (si lo escribe). Al cerrar, closedReason
 *       es `admin`. Los estudiantes no cambian los Dates de estado: pasan a En curso con el primer mensaje del chat
 *       y se cierran solos al caducar.
 *     parameters:
 *       - in: path
 *         name: dateId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/DateUpdateInput' }
 *     responses:
 *       200: { $ref: '#/components/responses/DateOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       422: { $ref: '#/components/responses/Unprocessable' }
 */

// Ruta para cambiar el estado a mano: solo el admin
router.put('/:dateId', VerifyToken, RequireRole('admin'), ValidateId('dateId'), ValidateJoi(Schemas.date.update), controller.updateDate);

/**
 * @openapi
 * /dates/{dateId}/extend:
 *   post:
 *     tags: [Dates]
 *     summary: Usa la prórroga de un Date (24 horas más)
 *     description: >
 *       Solo hay una prórroga por Date (409 si ya se ha usado) y no se puede prorrogar un Date cerrado (409).
 *       Queda en el historial quién la pidió, y la sala del chat recibe el Date actualizado (`date:updated`).
 *     parameters:
 *       - in: path
 *         name: dateId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       200: { $ref: '#/components/responses/DateOne' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *       409: { $ref: '#/components/responses/AlreadyExtended' }
 */

// Ruta para usar la prorroga
router.post('/:dateId/extend', VerifyToken, ValidateId('dateId'), controller.extendDate);

/**
 * @openapi
 * /dates/{dateId}/messages:
 *   get:
 *     tags: [Dates]
 *     summary: El historial del chat de un Date, paginado
 *     description: >
 *       La página 1 son los mensajes más nuevos; dentro de cada página van en orden cronológico. Lo pueden pedir
 *       los dos usuarios del Date y el admin (404 si el Date es de otros). Los mensajes nuevos llegan por
 *       socket.io (evento `date:message`), no por aquí.
 *     parameters:
 *       - in: path
 *         name: dateId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *       - in: query
 *         name: page
 *         schema: { type: integer, minimum: 1, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, minimum: 1, maximum: 100, default: 10 }
 *     responses:
 *       200: { $ref: '#/components/responses/MessageList' }
 *       400: { $ref: '#/components/responses/InvalidPagination' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Ruta para leer el historial del chat
router.get('/:dateId/messages', VerifyToken, ValidateId('dateId'), ValidatePagination, controller.readMessages);

/**
 * @openapi
 * /dates/{dateId}:
 *   delete:
 *     tags: [Dates]
 *     summary: Elimina un Date (solo admin)
 *     description: Borrado físico. Si el Date tenía un Plan, también se elimina.
 *     parameters:
 *       - in: path
 *         name: dateId
 *         required: true
 *         schema: { type: string, pattern: '^[0-9a-fA-F]{24}$' }
 *     responses:
 *       204:
 *         description: Date eliminado
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       403: { $ref: '#/components/responses/Forbidden' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */

// Ruta para eliminar un Date: esta si es solo para el admin
router.delete('/:dateId', VerifyToken, RequireRole('admin'), ValidateId('dateId'), controller.deleteDate);

export = router;

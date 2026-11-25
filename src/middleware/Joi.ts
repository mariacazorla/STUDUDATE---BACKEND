import Joi, { ObjectSchema } from 'joi';

import { NextFunction, Request, Response } from 'express';

import { DATE_STATUSES, DateStatus } from '../models/Date';
import { GRADE_VALUES, GradeValue, IGrade } from '../models/Grade';
import { MESSAGE_MAX_LENGTH } from '../models/Message';
import { ISpin, MAX_SPINS, PLAN_STATUSES, PlanStatus } from '../models/Plan';
import { REPORT_REASONS, REPORT_SEVERITIES } from '../models/Report';
import { IUser, MAX_TRUSTED_CONTACTS, PHOTO_MAX_LENGTH, USER_ROLES, UserRole } from '../models/User';

// Cuantos elementos devuelve un listado si la peticion no dice limit. Esta en un solo sitio para
// que todos los listados paginen igual
export const PAGE_SIZE = 10;

export interface PaginationQuery {
    page: number;
    limit: number;
    search: string;
}

// Los filtros del listado de usuarios del backoffice: la paginacion y la busqueda de siempre,
// y ademas el rol, si esta activo y si esta archivado
export interface UserListQuery extends PaginationQuery {
    role?: UserRole;
    active?: boolean;
    degree?: string;
    archived: boolean;
}

// Los filtros del listado de Dates: la paginacion, el estado y un usuario
export interface DateListQuery {
    page: number;
    limit: number;
    status?: DateStatus;
    user?: string;
}

// Los filtros del listado de votos de La Orla: la paginacion, la nota y un usuario
export interface GradeListQuery {
    page: number;
    limit: number;
    value?: GradeValue;
    user?: string;
}

// Los filtros del listado de Planes: la paginacion con la busqueda de texto (en el sitio de las tiradas),
// el estado, un Date concreto y si se listan los archivados. Todos se pueden combinar en la misma ruta
export interface PlanListQuery extends PaginationQuery {
    status?: PlanStatus;
    date?: string;
    archived: boolean;
}

// Funcion que se encarga de validar los datos que llegan en una petición
// Recibe un esquema de Joi y comprueba que el body cumple sus condiciones
export const ValidateJoi = (schema: ObjectSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            // Comprobamos que los datos del body cumplen el esquema.
            // Si la peticion llega sin body, Express 5 deja req.body en undefined, y Joi da por bueno un
            // undefined aunque el esquema tenga campos required. Validamos {} en su lugar para que salga
            // el 422 de siempre ("date" is required) y no un 500 en el controlador
            await schema.validateAsync(req.body ?? {});

            // Si la validacion es correcta continuamos con la siguiente funcion
            next();
        } catch (error) {
            // Si los datos no son validos pasamos el error al siguiente middleware
            next(error);
        }
    };
};

// Un id de MongoDB tiene 24 caracteres hexadecimales
// Esta expresion nos sirve para comprobar que tiene el formato correcto
const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

// Funcion que comprueba el id que llega en los parametros de la URL
// Si no tiene el formato de un id de MongoDB devolvemos un error 400
export const ValidateId = (paramName: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        // Cogemos el parametro de la URL usando el nombre que hemos recibido
        const id = req.params[paramName];

        // Comprobamos que existe y que tiene el formato correcto
        if (typeof id !== 'string' || !OBJECT_ID.test(id)) {
            // Si no es valido devolvemos un error de peticion incorrecta
            return res.status(400).json({ message: `${paramName} no es un id válido` });
        }

        // Si el id es correcto continuamos con la siguiente funcion
        next();
    };
};

// La foto de perfil llega como texto en base64 y solo puede ser PNG o JPG
const PHOTO = /^data:image\/(png|jpeg);base64,/;

// Campos del perfil de un usuario. Son los mismos al crear y al editar, asi que los escribimos una vez
const userProfile = {
    // La fecha de nacimiento es opcional y debe ser una fecha
    birthDate: Joi.date().example('2003-02-20'),

    // La titulacion es un texto libre
    degree: Joi.string().trim().max(100).example('Grau en Enginyeria Telemàtica'),

    // El "Qué busco" del perfil, como mucho 100 caracteres
    lookingFor: Joi.string().trim().max(100).example('Tomar algo después de clase'),

    // La bio puede ir vacia y no puede superar los 500 caracteres
    bio: Joi.string().trim().max(500).allow('').example('Siempre en la biblioteca de la EETAC, casi siempre con café.'),

    // La foto: una imagen PNG o JPG en base64. Con '' se quita la foto que tuviera
    photo: Joi.string().max(PHOTO_MAX_LENGTH).pattern(PHOTO).allow('')
};

// Una tirada de la ruleta
const spin = Joi.object<ISpin>({
    // trim + string: un sitio vacio ('' o '   ') no es valido
    place: Joi.string().trim().max(100).required().example('Cafetería de la EETAC'),

    // Minutos a pie desde el campus: un numero entero entre 0 y 120
    walkingMinutes: Joi.number().integer().min(0).max(120).required().example(5),

    // Fecha y hora en formato ISO, como las envia el frontend
    scheduledAt: Joi.date().iso().required().example('2026-11-12T18:00:00.000Z'),

    accepted: Joi.boolean().example(false)
});

// Las tiradas de un Plan: de 1 a 3
const spins = Joi.array().items(spin).min(1).max(MAX_SPINS).required();

// Reglas que miran el Plan entero, no un campo suelto:
//   - como mucho una tirada aceptada (el sitio elegido es uno)
//   - un Plan confirmado tiene que tener su tirada aceptada
// Si no se cumplen, Joi da un error con details y el ErrorHandler responde 422
const planRules: Joi.CustomValidator<{ status?: PlanStatus; spins: ISpin[] }> = (plan, helpers) => {
    const accepted = plan.spins.filter((item) => item.accepted).length;

    if (accepted > 1) {
        return helpers.message({ custom: 'Solo puede haber una tirada aceptada' });
    }

    if (plan.status === 'confirmed' && accepted === 0) {
        return helpers.message({ custom: 'Un Plan confirmado necesita una tirada aceptada' });
    }

    return plan;
};

// Aqui tenemos todos los esquemas de validacion que utilizamos en la aplicacion
export const Schemas = {
    // Validacion de los parametros de paginacion
    pagination: Joi.object<PaginationQuery>({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(PAGE_SIZE),
        search: Joi.string().trim().max(100).allow('').default('')
    }),

    // Validacion de los filtros del listado de usuarios: los de la paginacion y tres mas
    userList: Joi.object<UserListQuery>({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(PAGE_SIZE),
        search: Joi.string().trim().max(100).allow('').default(''),

        // Solo los usuarios de un rol
        role: Joi.string().valid(...USER_ROLES),

        // Solo los activos (true) o solo los inactivos (false)
        active: Joi.boolean(),

        // Solo los de una titulacion (tiene que coincidir entera)
        degree: Joi.string().trim().max(100),

        // Por defecto se listan los usuarios no archivados; con archived=true, solo los archivados
        archived: Joi.boolean().default(false)
    }),

    // Validacion de los filtros del listado de Dates
    dateList: Joi.object<DateListQuery>({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(PAGE_SIZE),

        // Solo los de una bandeja: pending, ongoing o closed
        status: Joi.string().valid(...DATE_STATUSES),

        // Solo los de este usuario (este filtro solo lo usa el admin)
        user: Joi.string().regex(OBJECT_ID)
    }),

    // Validacion de los filtros del listado de Planes
    planList: Joi.object<PlanListQuery>({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(PAGE_SIZE),

        // Texto que se busca en el sitio de las tiradas ("cafe" encuentra "Cafetería de la EETAC")
        search: Joi.string().trim().max(100).allow('').default(''),

        // Solo los de un estado: proposing, confirmed o cancelled
        status: Joi.string().valid(...PLAN_STATUSES),

        // Solo el Plan de este Date
        date: Joi.string().regex(OBJECT_ID),

        // Por defecto se listan los no archivados; con archived=true, solo los archivados
        archived: Joi.boolean().default(false)
    }),

    // Validacion de los filtros del listado de votos
    gradeList: Joi.object<GradeListQuery>({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(PAGE_SIZE),

        // Solo los A+ o solo los F
        value: Joi.string().valid(...GRADE_VALUES),

        // Solo los votos en los que participa este usuario (dando o recibiendo la nota)
        user: Joi.string().regex(OBJECT_ID)
    }),

    // Validaciones de las rutas de autenticacion
    auth: {
        // Registro: nombre, email y contraseña.
        // No se acepta role: si alguien lo envia, Joi lo rechaza porque no esta en el esquema.
        // Asi nadie puede registrarse a si mismo como admin; todo usuario nuevo es user.
        register: Joi.object<IUser>({
            name: Joi.string().trim().required().example('Ana'),
            email: Joi.string().email().required().example('ana@example.com'),
            password: Joi.string().min(8).required().example('studate26')
        }),

        // Login: el email y la contraseña. Aqui no se comprueba la longitud de la contraseña:
        // si es incorrecta, el servidor responde 401 igualmente
        login: Joi.object<IUser>({
            email: Joi.string().email().required().example('admin@example.com'),
            password: Joi.string().required().example('studate26')
        }),

        // Refresh: la web no manda body (el refresh token va en la cookie), y por eso el campo es opcional.
        // La app del movil no tiene cookie y lo manda aqui
        refresh: Joi.object({
            refreshToken: Joi.string().example('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')
        })

        // Logout no tiene esquema: no lleva body
    },

    // Validaciones de la gestion de usuarios del backoffice
    user: {
        // Esquema que se utiliza cuando el admin crea un usuario
        create: Joi.object<IUser>({
            // El nombre, el email y la contraseña son obligatorios, como en el registro
            name: Joi.string().trim().required().example('Laia Puig'),
            email: Joi.string().email().required().example('laia@example.com'),
            password: Joi.string().min(8).required().example('studate26'),

            // A diferencia del registro, el admin si puede elegir el rol y si el usuario esta activo
            role: Joi.string().valid(...USER_ROLES),
            active: Joi.boolean(),

            ...userProfile
        }),

        // Esquema que se utiliza para editar un usuario.
        // La contraseña no se cambia desde aqui: no esta en el esquema, asi que enviarla da 422
        update: Joi.object<IUser>({
            name: Joi.string().trim().required(),
            email: Joi.string().email().required(),
            role: Joi.string().valid(...USER_ROLES),
            active: Joi.boolean(),

            ...userProfile
        }),

        // Esquema de Mi perfil: lo que un estudiante cambia de si mismo. No estan el email, el rol ni
        // active: si alguien los envia (por ejemplo role: 'admin'), Joi responde 422
        updateMe: Joi.object({
            name: Joi.string().trim().required().example('Laia Puig'),

            ...userProfile,

            // Los contactos de confianza: opcionales (se puede enviar una lista vacia para quitarlos) y
            // como mucho 3. Cada uno con nombre y email; el telefono es opcional
            trustedContacts: Joi.array()
                .items(
                    Joi.object({
                        name: Joi.string().trim().max(100).required().example('Marta Puig (hermana)'),
                        email: Joi.string().email().required().example('marta.puig@example.com'),
                        phone: Joi.string().trim().max(20).allow('').example('600 111 222')
                    })
                )
                .max(MAX_TRUSTED_CONTACTS)
        })
    },

    // Validaciones de los votos de La Orla
    grade: {
        // Esquema que se utiliza cuando el admin crea un voto
        create: Joi.object<IGrade>({
            // Quien vota y a quien: dos ids de usuario con formato de MongoDB
            from: Joi.string().regex(OBJECT_ID).required().example('6ab3f2fe9c500204a7d5f8a3'),
            to: Joi.string().regex(OBJECT_ID).required().example('6ab3f2fe9c500204a7d5f8a4'),

            // La nota tiene que ser A+ o F
            value: Joi.string()
                .valid(...GRADE_VALUES)
                .required()
                .example('A+')
        }),

        // Esquema que se utiliza para cambiar la nota: los usuarios de un voto no se cambian
        update: Joi.object<IGrade>({
            value: Joi.string()
                .valid(...GRADE_VALUES)
                .required()
        })
    },

    // Validaciones de La Orla (el flujo del estudiante: aqui "from" sale siempre del token)
    orla: {
        // Votar un Expediente: a quien (to) y que nota (A+ o F)
        vote: Joi.object({
            to: Joi.string().regex(OBJECT_ID).required().example('6ab3f2fe9c500204a7d5f8a4'),
            value: Joi.string()
                .valid(...GRADE_VALUES)
                .required()
                .example('A+')
        })
    },

    // Validaciones de los Dates
    date: {
        // Abrir un Date: los ids de los dos usuarios, distintos entre si
        create: Joi.object({
            users: Joi.array()
                .items(Joi.string().regex(OBJECT_ID))
                .length(2)
                .unique()
                .required()
                .example(['6ab3f2fe9c500204a7d5f8a3', '6ab3f2fe9c500204a7d5f8a4'])
        }),

        // Cambiar de bandeja: solo el estado
        update: Joi.object({
            status: Joi.string()
                .valid(...DATE_STATUSES)
                .required()
                .example('ongoing')
        })
    },

    // Validaciones de los Planes del backoffice
    plan: {
        // Crear un Plan: el Date, las tiradas y, si se quiere, el estado (si no, proposing)
        create: Joi.object({
            date: Joi.string().regex(OBJECT_ID).required().example('6ab3f2fe9c500204a7d5f8b1'),
            status: Joi.string()
                .valid(...PLAN_STATUSES)
                .example('proposing'),
            spins
        }).custom(planRules),

        // Editar un Plan: el estado y las tiradas. El Date no se cambia: enviarlo da 422
        update: Joi.object({
            status: Joi.string()
                .valid(...PLAN_STATUSES)
                .required()
                .example('confirmed'),
            spins
        }).custom(planRules)
    },

    // ---- Modelos del Sprint 2. Sus rutas llegan con cada funcionalidad; los esquemas ya estan aqui ----
    // En ninguno se acepta quien hace la peticion (from, blocker, reporter, user): sale siempre del
    // token (req.user), asi nadie puede escribir, bloquear o mandar un parte en nombre de otro

    // Validaciones del chat
    message: {
        // Enviar un mensaje: solo el texto. El Date es la sala del chat
        create: Joi.object({
            // trim + min(1): un mensaje vacio ('' o '   ') no es valido
            text: Joi.string().trim().min(1).max(MESSAGE_MAX_LENGTH).required().example('¿Quedamos en la cafetería de la EETAC?')
        })
    },

    // Validaciones de los bloqueos
    block: {
        // Bloquear a alguien: el id del usuario al que se bloquea
        create: Joi.object({
            blocked: Joi.string().regex(OBJECT_ID).required().example('6ab3f2fe9c500204a7d5f8a4')
        })
    },

    // Validaciones de los partes
    report: {
        // Mandar un parte: sobre quien, por que y, si se quiere, el Date donde paso y un comentario
        create: Joi.object({
            reported: Joi.string().regex(OBJECT_ID).required().example('6ab3f2fe9c500204a7d5f8a4'),
            date: Joi.string().regex(OBJECT_ID).example('6ab3f2fe9c500204a7d5fa01'),
            reason: Joi.string()
                .valid(...REPORT_REASONS)
                .required()
                .example('harassment'),
            text: Joi.string().trim().max(500).allow('').example('No para de escribirme aunque le he dicho que no.')
        }),

        // Revisar un parte (solo admin): se queda como revisado o descartado, con la gravedad y lo que se ha hecho.
        // 'open' no se acepta: un parte revisado no vuelve a quedar abierto
        review: Joi.object({
            status: Joi.string().valid('reviewed', 'dismissed').required().example('reviewed'),
            severity: Joi.string()
                .valid(...REPORT_SEVERITIES)
                .example('high'),
            resolution: Joi.string().trim().max(500).allow('').example('Cuenta desactivada y aviso al usuario.')
        })
    },

    // Validaciones de las alertas de seguridad (el boton de ayuda)
    safetyAlert: {
        // Pedir ayuda: todo es opcional, porque quien pide ayuda no esta para rellenar un formulario.
        // Si se pide desde un chat, viaja el Date (o el Plan) para saber con quien esta
        create: Joi.object({
            date: Joi.string().regex(OBJECT_ID).example('6ab3f2fe9c500204a7d5fa01'),
            plan: Joi.string().regex(OBJECT_ID).example('6ab3f2fe9c500204a7d5fb01'),
            message: Joi.string().trim().max(300).allow('').example('Me siento incómoda, ¿podéis llamarme?')
        }),

        // Atender una alerta (solo admin): atendida o falsa alarma. 'open' no se acepta
        attend: Joi.object({
            status: Joi.string().valid('attended', 'false_alarm').required().example('attended')
        })
    }
};

export const ValidatePagination = (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = Schemas.pagination.validate(req.query);

    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    res.locals.query = value;
    next();
};

// Igual que ValidatePagination, pero con los filtros del listado de Dates
export const ValidateDateList = (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = Schemas.dateList.validate(req.query);

    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    res.locals.query = value;
    next();
};

// Igual que ValidatePagination, pero con los filtros del listado de Planes
export const ValidatePlanList = (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = Schemas.planList.validate(req.query);

    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    res.locals.query = value;
    next();
};

// Igual que ValidatePagination, pero con los filtros del listado de votos
export const ValidateGradeList = (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = Schemas.gradeList.validate(req.query);

    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    res.locals.query = value;
    next();
};

// Igual que ValidatePagination, pero con los filtros del listado de usuarios.
// Joi convierte los textos de la URL a su tipo: "2" pasa a 2 y "false" pasa a false
export const ValidateUserList = (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = Schemas.userList.validate(req.query);

    if (error) {
        return res.status(400).json({ message: error.details[0].message });
    }

    res.locals.query = value;
    next();
};

import dotenv from 'dotenv';
import type { SignOptions } from 'jsonwebtoken';

dotenv.config({ quiet: true });

// Lee una variable del .env que es obligatoria.
// Si falta, el servidor no arranca y dice cuál es, en lugar de fallar más tarde sin explicación.
const required = (name: string) => {
    const value = process.env[name];

    if (!value) {
        throw new Error(`Falta la variable ${name} en el .env (cópiala de .env.example)`);
    }

    return value;
};

const MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/studate';

// Orígenes exactos desde los que un navegador puede llamar a la API, separados por comas en el .env.
// Son varios porque hay más de un frontend: la web de Vite (5173), la app de Expo abierta en el navegador
// (8081) y, en el servidor, la dirección pública. Como el refresh token va en una cookie, CORS tiene que
// aceptar credenciales y con credenciales no se puede usar '*'.
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:8081')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

const SERVER_PORT = process.env.SERVER_PORT ? Number(process.env.SERVER_PORT) : 1337;

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Ruta a la que el navegador envía la cookie del refresh token. En local la API cuelga de la raíz y es
// /auth. En el servidor, nginx sirve la API detrás de /api, así que el navegador ve /api/auth: si la
// cookie se quedara con /auth, no la enviaría nunca.
const REFRESH_COOKIE_PATH = process.env.REFRESH_COOKIE_PATH || '/auth';

// La cookie del refresh token se marca como Secure (solo viaja por HTTPS). Por defecto, en producción
// sí y en desarrollo no, porque el frontend va por http://localhost. Se puede forzar con COOKIE_SECURE
// (true o false), por ejemplo para probar el contenedor de producción por http antes de tener HTTPS.
const COOKIE_SECURE = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : IS_PRODUCTION;

// Secretos con los que se firman los tokens. Son dos distintos para que un refresh token
// no sirva como access token ni al revés.
const JWT_SECRET = required('JWT_SECRET');
const JWT_REFRESH_SECRET = required('JWT_REFRESH_SECRET');

// Cuánto dura cada token, con el formato de la librería ms: '15m', '7d', '2s'...
// El tipo de expiresIn de jsonwebtoken solo acepta ese formato, por eso el "as".
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '15m') as SignOptions['expiresIn'];
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

export const config = {
    mongo: {
        url: MONGO_URL
    },
    server: {
        port: SERVER_PORT,
        isProduction: IS_PRODUCTION
    },
    cors: {
        origins: CORS_ORIGINS
    },
    cookie: {
        refreshPath: REFRESH_COOKIE_PATH,
        secure: COOKIE_SECURE
    },
    jwt: {
        secret: JWT_SECRET,
        refreshSecret: JWT_REFRESH_SECRET,
        expiresIn: JWT_EXPIRES_IN,
        refreshExpiresIn: JWT_REFRESH_EXPIRES_IN
    }
};

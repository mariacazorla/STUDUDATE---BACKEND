import cors from 'cors';
import { config } from '../config/config';

// Middleware de CORS: le dice al navegador desde qué orígenes se puede llamar a esta API.
// Los orígenes se configuran en el .env con CORS_ORIGINS, separados por comas (por defecto, la web de
// Vite en http://localhost:5173 y la app de Expo en el navegador en http://localhost:8081). De las
// peticiones OPTIONS (las que manda el navegador antes de la real) se encarga el propio paquete cors.
//
// Al pasarle una lista, cors solo responde con Access-Control-Allow-Origin si el origen de la petición
// está en ella: desde cualquier otra web, el navegador bloquea la respuesta. Las peticiones sin cabecera
// Origin (la app del móvil, curl, Swagger en la misma dirección) no pasan por CORS y siguen funcionando:
// CORS es una protección del navegador, y a esas peticiones las protege el token.
//
// credentials: true hace falta para que el navegador envíe y acepte la cookie del refresh token.
// Con credenciales el origen tiene que ser exacto: el navegador rechaza '*'.
//
// X-Client es la cabecera con la que la app del móvil pide el refresh token en el JSON (ver controllers/Auth.ts).
export const Cors = cors({
    origin: config.cors.origins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'X-Client']
});

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";
import { mountBillingWebhook } from "./routes/billing-webhook";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// CORS: em produção, aceita apenas origens explicitamente listadas em ALLOWED_ORIGINS.
// Ex.: ALLOWED_ORIGINS=https://synvet.app.br,https://www.synvet.app.br,https://synvet.vercel.app
// Em desenvolvimento sem a variável, libera tudo (comportamento anterior).
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean)
  : [];
// Sufixos de origem permitidos (CSV) — útil para domínios de preview do Vercel,
// que mudam a cada deploy. Ex.: ALLOWED_ORIGIN_SUFFIXES=-minha-team.vercel.app
// cobre tanto produção quanto previews da mesma conta/projeto.
const allowedOriginSuffixes = process.env.ALLOWED_ORIGIN_SUFFIXES
  ? process.env.ALLOWED_ORIGIN_SUFFIXES.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const corsConfigured = allowedOrigins.length > 0 || allowedOriginSuffixes.length > 0;

app.use(
  cors({
    origin: corsConfigured
      ? (origin, cb) => {
          // Requisições sem Origin (ex.: curl, mobile nativo) são permitidas.
          if (
            !origin ||
            allowedOrigins.includes(origin) ||
            allowedOriginSuffixes.some((suffix) => origin.endsWith(suffix))
          ) {
            return cb(null, true);
          }
          cb(new Error(`CORS: origin '${origin}' not allowed`));
        }
      : true,
    credentials: true,
  }),
);

// IMPORTANTE: webhook Stripe precisa do raw body para validar assinatura.
// Deve ser montado ANTES do express.json() global.
mountBillingWebhook(app);

// Limite global de 5 MB — bate com o teto declarado da importação CSV
// (5k linhas × campos textuais ficam bem abaixo desse teto na prática).
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", router);

export default app;

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
app.use(cors());

// IMPORTANTE: webhook Stripe precisa do raw body para validar assinatura.
// Deve ser montado ANTES do express.json() global.
mountBillingWebhook(app);

// Limite global de 5 MB — bate com o teto declarado da importação CSV
// (5k linhas × campos textuais ficam bem abaixo desse teto na prática).
app.use(express.json({ limit: "5mb" }));
app.use(express.urlencoded({ extended: true, limit: "5mb" }));

app.use("/api", router);

export default app;

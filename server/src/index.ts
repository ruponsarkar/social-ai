import cors from "cors";
import express from "express";
import { env } from "./config/env.js";
import routes from "./routes/index.js";
import { startScheduler } from "./services/scheduler/cron.js";

const app = express();

app.use(
  cors({
    origin: env.CLIENT_ORIGIN
  })
);
app.use(express.json());
app.use("/api", routes);

app.listen(env.PORT, () => {
  startScheduler();
  console.log(`Server running on http://localhost:${env.PORT}`);
});


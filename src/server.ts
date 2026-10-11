import app from "./app";
import { env } from "./config/env";
import { connectDB } from "./config/db";


import "./models";


const start = async (): Promise<void> => {
  await connectDB();
  const server = app.listen(env.port, () =>
    console.log(`Server running on port ${env.port} (${env.nodeEnv})`)
  );

  const shutdown = () => server.close(() => process.exit(0));
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("unhandledRejection", (err) => {
    console.error("Unhandled rejection:", err);
    server.close(() => process.exit(1));
  });
};

start().catch((err: Error) => {
  console.error("Failed to start server:", err.message);
  process.exit(1);
});
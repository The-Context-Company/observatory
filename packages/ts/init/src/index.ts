import { run } from "./run.js";

run().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});

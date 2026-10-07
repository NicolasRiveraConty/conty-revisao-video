import { buildApp } from "./app.js";
import { MemoryRepository } from "./repository.js";
import { CampaignService } from "./service.js";

const port = Number(process.env.PORT ?? 3000);
const app = buildApp(new CampaignService(new MemoryRepository()));

await app.listen({ port, host: "0.0.0.0" });
console.log(`API em http://localhost:${port}`);

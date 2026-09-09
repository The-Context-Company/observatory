import { Mastra } from "@mastra/core/mastra";
import { Observability } from "@mastra/observability";
import { weatherAgent } from "./agents/weather-agent";
import { TCCMastraExporter } from "@contextcompany/mastra";

// TCC: Initialize Mastra with TCC observability exporter
export const mastra = new Mastra({
  agents: { weatherAgent },
  observability: new Observability({
    configs: {
      default: {
        serviceName: "mastra-weather-agent",
        exporters: [new TCCMastraExporter({})],
      },
    },
  }),
});

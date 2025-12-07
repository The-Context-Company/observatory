import { Mastra } from "@mastra/core/mastra";
import { weatherAgent } from "./agents/weather-agent";
import { TCCMastraExporter } from "@contextcompany/mastra";

// TCC: Initialize Mastra with TCC observability exporter
export const mastra = new Mastra({
  agents: { weatherAgent },
  observability: {
    configs: {
      otel: {
        serviceName: "mastra-weather-agent",
        exporters: [new TCCMastraExporter({})],
      },
    },
  },
});

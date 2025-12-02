import { Mastra } from '@mastra/core/mastra';
import { OtelExporter } from '@mastra/otel-exporter';
import { weatherAgent } from './agents/weather-agent';

export const mastra = new Mastra({
  agents: { weatherAgent },
  observability: {
    configs: {
      otel: {
        serviceName: 'mastra-weather-agent',
        exporters: [
          new OtelExporter({
            provider: {
              custom: {
                endpoint: process.env.TCC_URL,
                protocol: 'http/json',
                headers: {
                  'Authorization': `Bearer ${process.env.TCC_API_KEY}`,
                },
              },
            },
          }),
        ],
      },
    },
  },
});

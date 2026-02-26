const KNOWLEDGE_BASE: Record<string, string[]> = {
  revenue: ["Q3 2024 Report.pdf", "Revenue Dashboard", "Forecast Model v4"],
  churn: ["Churn Analysis Deck", "Retention Playbook", "Cohort Breakdown"],
  onboarding: ["Onboarding Playbook v3", "Customer Success Runbook"],
};

const DB_ROWS = [
  { quarter: "Q3", revenue: 4_200_000, churn_rate: 0.031, nps: 72 },
  { quarter: "Q2", revenue: 3_560_000, churn_rate: 0.044, nps: 65 },
];

export type ToolResult = {
  tool: string;
  args: Record<string, unknown>;
  result: string;
};

export function searchKnowledgeBase(query: string): string {
  const key = Object.keys(KNOWLEDGE_BASE).find((k) =>
    query.toLowerCase().includes(k)
  );
  const results = key ? KNOWLEDGE_BASE[key] : ["No results found"];
  return JSON.stringify({ query, results });
}

export function queryDatabase(sql: string): string {
  return JSON.stringify({ sql, rows: DB_ROWS });
}

export function createTicket(title: string, priority = "medium"): string {
  return JSON.stringify({
    ticket_id: "ENG-4521",
    title,
    priority,
    status: "created",
    assigned_to: "oncall-team",
  });
}

const TOOL_HANDLERS: Record<string, (args: Record<string, unknown>) => string> =
  {
    search_knowledge_base: (a) => searchKnowledgeBase(a.query as string),
    query_database: (a) => queryDatabase(a.sql as string),
    create_ticket: (a) => createTicket(a.title as string, a.priority as string),
  };

export function executeTool(
  name: string,
  args: Record<string, unknown>
): string {
  const handler = TOOL_HANDLERS[name];
  if (!handler) return JSON.stringify({ error: `Unknown tool: ${name}` });
  return handler(args);
}

export const TOOL_DEFINITIONS = [
  {
    type: "function",
    function: {
      name: "search_knowledge_base",
      description: "Search the internal knowledge base.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_database",
      description: "Run a read-only SQL query.",
      parameters: {
        type: "object",
        properties: { sql: { type: "string" } },
        required: ["sql"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_ticket",
      description: "Create an engineering ticket.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          priority: {
            type: "string",
            enum: ["low", "medium", "high", "critical"],
          },
        },
        required: ["title"],
      },
    },
  },
];

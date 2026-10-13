// MCP tool results are returned as pretty-printed JSON text — the shape every
// RiseUp tool description documents.
export function jsonToolResult(result: unknown): { content: { type: 'text', text: string }[] } {
  return {
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

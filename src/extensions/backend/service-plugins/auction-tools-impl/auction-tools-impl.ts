import { toolsProvider } from '@wix/app-tools/service-plugins';
import { TOOL_HANDLERS, ToolInputError } from '../../../../lib/server/aria-tools';

// Runs the tools declared in the `auction-tools` App Tools extension when Aria,
// Wix's AI assistant, calls them from the site dashboard.
toolsProvider.provideHandlers({
  runTool: async ({ request, metadata }) => {
    const methodName = request.methodName ?? '';
    const handler = TOOL_HANDLERS[methodName];

    if (!handler) {
      throw new Error(`Unknown tool: ${methodName || '(empty)'}`);
    }

    // These tools manage the owner's auctions, so they must never run for a
    // site visitor or member identity.
    const identity = metadata?.identity;
    if (identity?.memberId || identity?.anonymousVisitorId) {
      throw new Error('Auction tools are available to site collaborators only.');
    }

    try {
      return { response: await handler(request.payload ?? {}) };
    } catch (error) {
      if (!(error instanceof ToolInputError)) {
        console.error(`[aria-tools] ${methodName} failed`, { requestId: metadata?.requestId, error });
      }
      // Service errors (plan limits, product already linked, etc.) are written
      // for people, so pass them through for Aria to relay.
      throw new Error(error instanceof Error ? error.message : `The ${methodName} tool failed.`);
    }
  },
});

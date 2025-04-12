import { ObsidianLLMTool, OpenAICompatibleClient, Tool } from "./api/openai";

/**
 * An LLM-powered "agent" using the Obsidian request 
 */
export class ObsidianAgent {
    client: OpenAICompatibleClient;
    tool: Tool;
    toolImpl: ObsidianLLMTool;

    constructor(client: OpenAICompatibleClient, tool: Tool) {
        this.client = client;
        this.tool = tool;
        this.toolImpl = this.createTool();
    }

    createTool(): ObsidianLLMTool {
        return {};
    }
}
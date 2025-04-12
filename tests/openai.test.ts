import {
    ChatCompletionResponse,
    Message,
    ObsidianLLMTool,
    OpenAiClientConfig,
    OpenAICompatibleClient,
    ToolCall
} from '../src/api/openai';

import { request as mockRequest } from '../__mocks__/obsidian';

const createMockResponse = (message: Partial<Message>, id = 'chatcmpl-123', model = 'gpt-test'): ChatCompletionResponse => ({
    id: id,
    object: 'chat.completion',
    created: Date.now(),
    model: model,
    choices: [{
        index: 0,
        message: {
            role: 'assistant',
            ...message
        }
    }]
});

const createMockToolCall = (id: string, functionName: string, args: object): ToolCall => ({
    id,
    type: 'function',
    function: {
        name: functionName,
        arguments: JSON.stringify(args)
    }
});

describe('OpenAICompatibleClient', () => {
    let client: OpenAICompatibleClient;
    const minimalConfig: OpenAiClientConfig = {
        apiKey: 'test-key',
        model: 'test-model'
    };

    beforeEach(() => {
        client = new OpenAICompatibleClient(minimalConfig);
        mockRequest.mockReset();
    });

    describe('Constructor', () => {
        it('should initialize with default baseURL if not provided', () => {
            expect((client as any).baseURL).toBe('https://api.openai.com/v1');
        });

        it('should initialize with provided baseURL and remove trailing slash', () => {
            const configWithBaseUrl = { ...minimalConfig, baseUrl: "http://localhost:11434/v1/" };
            const customClient = new OpenAICompatibleClient(configWithBaseUrl);
            expect((customClient as any).baseURL).toBe('http://localhost:11434/v1');
        });

        it('should initialize apiKey and model', () => {
            expect((client as any).apiKey).toBe('test-key');
            expect((client as any).model).toBe('test-model');
        });

        it('should set default headers including Authorization', () => {
            expect((client as any).headers).toEqual({
                'Authorization': 'Bearer test-key',
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            });
        });

        it('should set custom headers', () => {
            const configWithHeaders = { ...minimalConfig, headers: { 'X-Custom': 'value' } };
            const customClient = new OpenAICompatibleClient(configWithHeaders);
            expect((customClient as any).headers).toEqual({
                'Authorization': 'Bearer test-key',
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'X-Custom': 'value'
            });
        });

        it('should initialize empty history if no system message', () => {
            expect(client.getHistory()).toEqual([]);
        });

        it('should initialize history with system message if provided', () => {
            const configWithSystem = { ...minimalConfig, systemMessage: 'You are a test bot.' };
            const customClient = new OpenAICompatibleClient(configWithSystem);
            expect(customClient.getHistory()).toEqual([{ role: 'system', content: 'You are a test bot.' }]);
        });

        it('should initialize tools if provided', () => {
            const mockTool: ObsidianLLMTool = {
                toolConfig: { type: 'function', function: { name: 'test_tool', parameters: { type: 'object', properties: {}, required: [""] } } },
                implementation: async () => 'tool result'
            };
            const configWithTools = { ...minimalConfig, tools: [mockTool] };
            const customClient = new OpenAICompatibleClient(configWithTools);
            expect(customClient.getTools()).toEqual([mockTool]);
        });

        it('should set default toolCallLimit', () => {
            expect((client as any).toolCallLimit).toBe(5);
        });

        it('should set custom toolCallLimit', () => {
            const configWithLimit = { ...minimalConfig, toolCallLimit: 3 };
            const customClient = new OpenAICompatibleClient(configWithLimit);
            expect((customClient as any).toolCallLimit).toBe(3);
        });

        it('should initialize debugging flag', () => {
            expect((client as any).isDebugging).toBe(false);
            const debugClient = new OpenAICompatibleClient({ ...minimalConfig, isDebugging: true });
            expect((debugClient as any).isDebugging).toBe(true);
        });
    });

    describe('chat (basic)', () => {
        beforeEach(() => {
            mockRequest.mockReset();
        });

        it('should send a user message and receive an assistant response', async () => {
            const mockResponse = createMockResponse({ role: 'assistant', content: 'Hello there!' });
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            const response = await client.chat('Hello');

            expect(response).toEqual(mockResponse);
            expect(mockRequest).toHaveBeenCalledTimes(1);
            const requestArgs = mockRequest.mock.calls[0][0]; // Get args of the first call
            expect(requestArgs.url).toBe('https://api.openai.com/v1/chat/completions');
            expect(requestArgs.method).toBe('POST');
            expect(JSON.parse(requestArgs.body)).toEqual({
                messages: [
                    { role: 'user', content: 'Hello' }
                ],
                model: 'test-model'
            });
        });
        it('should add user and assistant messages to history', async () => {
            const mockResponse = createMockResponse({ role: 'assistant', content: 'History test response' });
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            await client.chat('History test');

            expect(client.getHistory()).toEqual([
                { role: 'user', content: 'History test' },
                { role: 'assistant', content: 'History test response' }
            ]);
        });

        it('should include system message in request if configured', async () => {
            const configWithSystem = { ...minimalConfig, systemMessage: 'Be brief.' };
            const customClient = new OpenAICompatibleClient(configWithSystem);
            const mockResponse = createMockResponse({ role: 'assistant', content: 'OK.' });
            // mockRequest.mockReset();
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            await customClient.chat('Hello');

            expect(mockRequest).toHaveBeenCalledTimes(1);
            const requestBody = JSON.parse(mockRequest.mock.calls[0][0].body);
            expect(requestBody.messages).toEqual([
                { role: 'system', content: 'Be brief.' },
                { role: 'user', content: 'Hello' }
            ]);
            // Check history includes system message
            expect(customClient.getHistory()).toEqual([
                { role: 'system', content: 'Be brief.' },
                { role: 'user', content: 'Hello' },
                { role: 'assistant', content: 'OK.' }
            ]);
        });

        it('should throw an error if the API request fails', async () => {
            const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const apiError = new Error('Network Error');
            mockRequest.mockRejectedValue(apiError);

            await expect(client.chat('This will fail')).rejects.toThrow('Network Error');
            // Ensure history only contains the user message before failure
            expect(client.getHistory()).toEqual([
                { role: 'user', content: 'This will fail' }
            ]);
            expect(errorSpy).toHaveBeenCalled();
            errorSpy.mockRestore();
        });
    });

    describe('chat (with tools)', () => {
        let mockToolImplementation: jest.Mock;
        let mockTool: ObsidianLLMTool;

        beforeEach(() => {
            mockRequest.mockReset();
            // Reset tool implementation mock for each test
            mockToolImplementation = jest.fn().mockResolvedValue('Tool result data');
            mockTool = {
                toolConfig: {
                    type: 'function',
                    function: {
                        name: 'get_weather',
                        description: 'Gets the weather for a location',
                        parameters: {
                            type: 'object',
                            properties: {
                                location: { type: 'string', description: 'City and state, e.g. San Francisco, CA' },
                                unit: { type: 'string', enum: ['celsius', 'fahrenheit'] }
                            },
                            required: ['location']
                        }
                    }
                },
                implementation: mockToolImplementation
            };
            // Recreate client with the tool
            client = new OpenAICompatibleClient({
                ...minimalConfig,
                tools: [mockTool]
            });
        });

        it('should call tool implementation when assistant requests it', async () => {
            const toolCallId = 'call_123';
            const args = { location: 'Tokyo', unit: 'celsius' };
            const mockToolCall = createMockToolCall(toolCallId, 'get_weather', args);
            const firstApiResponse = createMockResponse({
                role: 'assistant',
                tool_calls: [mockToolCall]
            });
            const finalApiResponse = createMockResponse({ role: 'assistant', content: 'The weather in Tokyo is sunny.' });

            // Mock sequence: First API call returns tool_call, second returns final response
            mockRequest
                .mockResolvedValueOnce(JSON.stringify(firstApiResponse)) // Response asking for tool
                .mockResolvedValueOnce(JSON.stringify(finalApiResponse)); // Final response after tool execution

            const response = await client.chat('What is the weather in Tokyo?');

            // 1. Check final response
            expect(response).toEqual(finalApiResponse);

            // 2. Check API calls
            expect(mockRequest).toHaveBeenCalledTimes(2);

            // 3. Check first API call body
            const firstRequestBody = JSON.parse(mockRequest.mock.calls[0][0].body);
            expect(firstRequestBody.messages).toEqual([
                { role: 'user', content: 'What is the weather in Tokyo?' }
            ]);
            expect(firstRequestBody.tools).toEqual([mockTool.toolConfig]); // Ensure tool config was sent

            // 4. Check tool implementation call
            expect(mockToolImplementation).toHaveBeenCalledTimes(1);
            expect(mockToolImplementation).toHaveBeenCalledWith(args); // Ensure correct args were passed

            // 5. Check second API call body
            const secondRequestBody = JSON.parse(mockRequest.mock.calls[1][0].body);
            expect(secondRequestBody.messages).toEqual([
                { role: 'user', content: 'What is the weather in Tokyo?' },
                { role: 'assistant', tool_calls: [mockToolCall] }, // Assistant's request for tool
                { role: 'tool', tool_call_id: toolCallId, content: 'Tool result data' } // Our tool's response
            ]);
            expect(secondRequestBody.tools).toEqual([mockTool.toolConfig]); // Tools should still be sent

            // 6. Check final history
            expect(client.getHistory()).toEqual([
                { role: 'user', content: 'What is the weather in Tokyo?' },
                { role: 'assistant', tool_calls: [mockToolCall] },
                { role: 'tool', tool_call_id: toolCallId, content: 'Tool result data' },
                { role: 'assistant', content: 'The weather in Tokyo is sunny.' } // Final assistant message
            ]);
        });

        it('should handle tool implementation errors gracefully', async () => {
            const toolCallId = 'call_err';
            const args = { location: 'Error City' };
            const mockToolCall = createMockToolCall(toolCallId, 'get_weather', args);
            const firstApiResponse = createMockResponse({ role: 'assistant', tool_calls: [mockToolCall] });
            const finalApiResponse = createMockResponse({ role: 'assistant', content: 'Sorry, I could not get the weather.' });
            const toolError = new Error('Failed to fetch weather');

            // Mock tool to throw an error
            mockToolImplementation.mockRejectedValue(toolError);
            // Mock console.error to check if it was called
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });


            mockRequest
                .mockResolvedValueOnce(JSON.stringify(firstApiResponse))
                .mockResolvedValueOnce(JSON.stringify(finalApiResponse));

            const response = await client.chat('Weather in Error City');

            expect(response).toEqual(finalApiResponse);
            expect(mockToolImplementation).toHaveBeenCalledWith(args);
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error executing tool ${mockTool.toolConfig.function.name}`), toolError);
            expect(mockRequest).toHaveBeenCalledTimes(2);

            const secondRequestBody = JSON.parse(mockRequest.mock.calls[1][0].body);
            expect(secondRequestBody.messages).toContainEqual({
                role: 'tool',
                tool_call_id: toolCallId,
                content: `Error executing tool ${mockTool.toolConfig.function.name}.` // Error message sent back to LLM
            });

            consoleErrorSpy.mockRestore(); // Clean up spy
        });
        it('should handle non-existent tool errors gracefully', async () => {
            const toolCallId = 'call_missing';
            const args = {};
            // Request a tool that isn't configured on the client
            const mockToolCall = createMockToolCall(toolCallId, 'non_existent_tool', args);
            const firstApiResponse = createMockResponse({ role: 'assistant', tool_calls: [mockToolCall] });
            const finalApiResponse = createMockResponse({ role: 'assistant', content: 'I tried using a tool that was not available.' });

            // Mock console.error to check if it was called
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            mockRequest
                .mockResolvedValueOnce(JSON.stringify(firstApiResponse))
                .mockResolvedValueOnce(JSON.stringify(finalApiResponse));

            const response = await client.chat('Use a missing tool');

            expect(response).toEqual(finalApiResponse);
            expect(mockToolImplementation).not.toHaveBeenCalled(); // Original tool should not be called
            expect(consoleErrorSpy).toHaveBeenCalledWith('No tool exists with name non_existent_tool.');
            expect(mockRequest).toHaveBeenCalledTimes(2);

            const secondRequestBody = JSON.parse(mockRequest.mock.calls[1][0].body);
            expect(secondRequestBody.messages).toContainEqual({
                role: 'tool',
                tool_call_id: toolCallId,
                content: 'No tool exists with name non_existent_tool.' // Error message sent back
            });

            consoleErrorSpy.mockRestore();
        });

        it('should handle tool argument parsing errors gracefully', async () => {
            const toolCallId = 'call_bad_args';
            const mockToolCall: ToolCall = { // Manually create malformed args
                id: toolCallId,
                type: 'function',
                function: {
                    name: 'get_weather',
                    arguments: '{ "location": "Missing Quote }' // Invalid JSON
                }
            };
            const firstApiResponse = createMockResponse({ role: 'assistant', tool_calls: [mockToolCall] });
            const finalApiResponse = createMockResponse({ role: 'assistant', content: 'There was an issue with the tool arguments.' });

            // Mock console.error to check if it was called
            const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });

            mockRequest
                .mockResolvedValueOnce(JSON.stringify(firstApiResponse))
                .mockResolvedValueOnce(JSON.stringify(finalApiResponse));

            const response = await client.chat('Use tool with bad args');

            expect(response).toEqual(finalApiResponse);
            expect(mockToolImplementation).not.toHaveBeenCalled();
            expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Failed to parse tool arguments:'), expect.any(SyntaxError));
            expect(mockRequest).toHaveBeenCalledTimes(2);

            const secondRequestBody = JSON.parse(mockRequest.mock.calls[1][0].body);
            expect(secondRequestBody.messages).toContainEqual({
                role: 'tool',
                tool_call_id: toolCallId,
                content: 'Error: Failed to parse tool arguments.' // Error message sent back
            });

            consoleErrorSpy.mockRestore();
        });

        it('should respect the toolCallLimit', async () => {
            const toolCallId = 'call_loop_';
            const args = { location: 'Loop City' };
            const mockToolCall = createMockToolCall(toolCallId + '0', 'get_weather', args);
            // Mock API to *always* return a tool call
            const loopingApiResponse = createMockResponse({ role: 'assistant', tool_calls: [mockToolCall] });
            const finalApiResponse = createMockResponse({ role: 'assistant', content: 'Reached tool limit.' }); // The response *after* the limit is hit

            const limit = 3;
            client = new OpenAICompatibleClient({ ...minimalConfig, tools: [mockTool], toolCallLimit: limit });

            // Mock API to return tool calls 'limit' times, then a final response
            mockRequest.mockResolvedValue(JSON.stringify(loopingApiResponse)); // Default for all calls initially
            mockRequest.mockResolvedValueOnce(JSON.stringify(createMockResponse({ role: 'assistant', tool_calls: [createMockToolCall('call_loop_0', 'get_weather', args)] }))); // 1st call
            mockRequest.mockResolvedValueOnce(JSON.stringify(createMockResponse({ role: 'assistant', tool_calls: [createMockToolCall('call_loop_1', 'get_weather', args)] }))); // 2nd call
            mockRequest.mockResolvedValueOnce(JSON.stringify(createMockResponse({ role: 'assistant', tool_calls: [createMockToolCall('call_loop_2', 'get_weather', args)] }))); // 3rd call (hits limit)
            mockRequest.mockResolvedValueOnce(JSON.stringify(finalApiResponse)); // 4th call (should return this)


            // Adjust the mocks - need specific responses for the loop
            mockRequest.mockReset(); // Clear previous default mock
            for (let i = 0; i < limit; i++) {
                const callId = `${toolCallId}${i}`;
                const toolCall = createMockToolCall(callId, 'get_weather', args);
                mockRequest.mockResolvedValueOnce(JSON.stringify(createMockResponse({ role: 'assistant', tool_calls: [toolCall] })));
            }
            // The final API call *after* the loop should return the final response
            mockRequest.mockResolvedValueOnce(JSON.stringify(finalApiResponse));


            const response = await client.chat('Cause a tool loop');

            // Should return the response received *after* the last allowed tool call attempt
            expect(response).toEqual(finalApiResponse);
            // API called initial + limit times
            expect(mockRequest).toHaveBeenCalledTimes(limit + 1);
            // Tool implementation called 'limit' times
            expect(mockToolImplementation).toHaveBeenCalledTimes(limit);

            // Check history - should contain user, limit assistant tool_calls, limit tool responses, and final assistant response
            const history = client.getHistory();
            expect(history[0]).toEqual({ role: 'user', content: 'Cause a tool loop' });
            expect(history.length).toBe(1 + limit * 2 + 1); // user + (assistant_tool_call + tool_response) * limit + final_assistant_response
            expect(history[history.length - 1]).toEqual(finalApiResponse.choices[0].message); // Last message is the final one
        });

    });
    // --- History Management ---
    describe('History Management', () => {
        beforeEach(() => {
            mockRequest.mockReset();
        });

        it('clearHistory should reset history (no system message)', async () => {
            const mockResponse = createMockResponse({ role: 'assistant', content: 'Hello there!' });
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            const response = await client.chat('Hello');
            client.clearHistory();
            expect(client.getHistory()).toEqual([]);
        });

        it('clearHistory should reset history (with system message)', async () => {
            const configWithSystem = { ...minimalConfig, systemMessage: 'System active.' };
            const customClient = new OpenAICompatibleClient(configWithSystem);

            const mockResponse = createMockResponse({ role: 'assistant', content: 'Hello there!' });
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            const response = await client.chat('Hello');
            customClient.clearHistory();
            expect(customClient.getHistory()).toEqual([{ role: 'system', content: 'System active.' }]);
        });

        it('getHistory should return a copy, not the original array', async () => {
            const mockResponse = createMockResponse({ role: 'assistant', content: 'Hello there!' });
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            const response = await client.chat('Hello');
            const history1 = client.getHistory();
            history1.push({ role: 'user', content: 'Modified history externally' });
            const history2 = client.getHistory();
            expect(history2).not.toEqual(history1); // Should not have the externally added message
            expect(history2.length).toBe(2); // user + mocked assistant
        });
    });

    // --- Configuration Setters ---
    describe('Configuration Setters', () => {
        it('setSystemPrompt should update the system message and clear history', async () => {
            const mockResponse = createMockResponse({ role: 'assistant', content: 'Hello there!' });
            mockRequest.mockResolvedValue(JSON.stringify(mockResponse));

            const response = await client.chat('Hello');
            client.setSystemPrompt('New system prompt.');
            expect((client as any).systemMessage).toEqual({ role: 'system', content: 'New system prompt.' });
            // clearHistory should be implicitly called by setSystemPrompt based on current implementation
            // Let's test the *effect*: history should be cleared and contain only the new system message
            client.clearHistory(); // Manually call clearHistory to test its interaction with the new system prompt
            expect(client.getHistory()).toEqual([{ role: 'system', content: 'New system prompt.' }]);
        });

        it('setBaseUrl should update the baseURL', () => {
            client.setBaseUrl('http://new-url.com/api');
            expect((client as any).baseURL).toBe('http://new-url.com/api');
            // Also test trailing slash removal
            client.setBaseUrl('http://new-url.com/api/');
            expect((client as any).baseURL).toBe('http://new-url.com/api');
        });

        it('addHeader should add a header', () => {
            client.addHeader('X-Test', 'TestValue');
            expect((client as any).headers['X-Test']).toBe('TestValue');
        });

        it('removeHeader should remove a header', () => {
            client.addHeader('X-RemoveMe', 'ToBeDeleted');
            client.removeHeader('X-RemoveMe');
            expect((client as any).headers['X-RemoveMe']).toBeUndefined();
        });

        it('addTool should add a tool to the list', () => {
            const newTool: ObsidianLLMTool = {
                toolConfig: { type: 'function', function: { name: 'added_tool', parameters: { type: 'object', properties: {}, required: [""] } } },
                implementation: async () => 'added result'
            };
            client.addTool(newTool);
            expect(client.getTools()).toEqual([newTool]);
            // Add another one
            const anotherTool: ObsidianLLMTool = {
                toolConfig: { type: 'function', function: { name: 'another_tool', parameters: { type: 'object', properties: {}, required: [""] } } },
                implementation: async () => 'another result'
            };
            client.addTool(anotherTool);
            expect(client.getTools()).toEqual([newTool, anotherTool]);
        });

        it('setApiKey should update the apiKey and Authorization header', () => {
            client.setApiKey('new-api-key');
            expect((client as any).apiKey).toBe('new-api-key');
            expect((client as any).headers['Authorization']).toBe('Bearer new-api-key');
            // Test removing key
            client.setApiKey('');
            expect((client as any).apiKey).toBe('');
            expect((client as any).headers['Authorization']).toBe(''); // Should be empty string or removed
        });

        it('setModel should update the default model', () => {
            client.setModel('new-default-model');
            expect((client as any).model).toBe('new-default-model');
        });
    });

    // --- toolResponse Method ---
    describe('toolResponse', () => {
        beforeEach(() => {
            mockRequest.mockReset();
        });

        it('should add a tool message to history and trigger conversationRequest', async () => {
            const toolCallId = 'manual_tool_call_123';
            const toolContent = 'Manual tool execution result';
            const finalResponse = createMockResponse({ role: 'assistant', content: 'Understood the tool result.' });

            // Mock the request that happens *after* toolResponse is called
            mockRequest.mockResolvedValue(JSON.stringify(finalResponse));

            // Add some initial conversation context (optional, but realistic)
            (client as any).messageHistory.push({ role: 'user', content: 'Initial prompt' });
            (client as any).messageHistory.push({ role: 'assistant', tool_calls: [createMockToolCall(toolCallId, 'some_tool', {})] });

            const response = await client.toolResponse(toolCallId, toolContent);

            expect(response).toEqual(finalResponse);
            expect(mockRequest).toHaveBeenCalledTimes(1); // Only the call from conversationRequest inside toolResponse

            const requestBody = JSON.parse(mockRequest.mock.calls[0][0].body);
            // History should include the manually added tool message
            expect(requestBody.messages).toEqual([
                { role: 'user', content: 'Initial prompt' },
                { role: 'assistant', tool_calls: [expect.objectContaining({ id: toolCallId })] },
                { role: 'tool', tool_call_id: toolCallId, content: toolContent } // The message added by toolResponse
            ]);

            // Check final history on the client
            expect(client.getHistory()).toEqual([
                { role: 'user', content: 'Initial prompt' },
                { role: 'assistant', tool_calls: [expect.objectContaining({ id: toolCallId })] },
                { role: 'tool', tool_call_id: toolCallId, content: toolContent },
                finalResponse.choices[0].message // Assistant's final response
            ]);
        });
    });
});
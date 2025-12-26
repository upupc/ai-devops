import { NextRequest } from "next/server";
import { getSession } from "@/lib/session-store";
import { getOrCreateChatSession } from "@/lib/chat-session";
import { createLogger } from "@/lib/logger";
import {SubscriberMessage} from "@/lib/types/agent";

const logger = createLogger("ChatAPI");

/**
 * POST /api/chat - 发送消息并获取 Agent 响应
 *
 * 使用新的 ChatSession 架构，基于 Streaming Input 模式
 */
export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    const createErrorString = (error: string) => {
        return `data: ${JSON.stringify({ 
            id:crypto.randomUUID(),
            type: "error",
            error:error
        })}\n\n`;
    };

    // 创建可读流
    const stream = new ReadableStream({
        async start(controller) {
            try {
                const body = await request.json();
                const { sessionId, message, model } = body;

                if (!sessionId || !message) {
                    controller.enqueue(encoder.encode(createErrorString("缺少必要参数")));
                    controller.close();
                    return;
                }

                const session = getSession(sessionId);
                if (!session) {
                    controller.enqueue(encoder.encode(createErrorString("会话不存在")));
                    controller.close();
                    return;
                }

                // 获取或创建 ChatSession
                const chatSession = getOrCreateChatSession(sessionId);
                if (!chatSession) {
                    controller.enqueue(encoder.encode(createErrorString("无法创建会话")));
                    controller.close();
                    return;
                }

                // 创建临时订阅者来接收消息
                const subscriber = {
                    send: (msg: SubscriberMessage) => {
                        try {
                            const parsed = msg;
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify(parsed)}\n\n`));
                            if(parsed.type=='result' || parsed.type=='error'){
                                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                controller.close();
                            }
                        } catch {
                            // 忽略解析错误
                        }
                    },
                    readyState: 1, // OPEN
                    OPEN: 1
                };

                // 订阅消息
                chatSession.subscribe(subscriber);

                // 发送消息到 Agent
                chatSession.sendMessage(model, message);

            } catch (error) {
                logger.error("Chat API 错误", { error });
                controller.enqueue(
                    encoder.encode(createErrorString("处理消息失败"))
                );
                controller.close();
            }
        }
    });

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive"
        }
    });
}

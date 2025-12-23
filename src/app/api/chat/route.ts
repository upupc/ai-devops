import { NextRequest } from "next/server";
import { getSession } from "@/lib/session-store";
import { getOrCreateChatSession } from "@/lib/chat-session";

/**
 * POST /api/chat - 发送消息并获取 Agent 响应
 *
 * 使用新的 ChatSession 架构，基于 Streaming Input 模式
 */
export async function POST(request: NextRequest) {
    const encoder = new TextEncoder();

    // 创建可读流
    const stream = new ReadableStream({
        async start(controller) {
            try {
                const body = await request.json();
                const { sessionId, message, model } = body;

                if (!sessionId || !message) {
                    controller.enqueue(encoder.encode('data: {"error": "缺少必要参数"}\n\n'));
                    controller.close();
                    return;
                }

                const session = getSession(sessionId);
                if (!session) {
                    controller.enqueue(encoder.encode('data: {"error": "会话不存在"}\n\n'));
                    controller.close();
                    return;
                }

                // 获取或创建 ChatSession
                const chatSession = getOrCreateChatSession(sessionId);
                if (!chatSession) {
                    controller.enqueue(encoder.encode('data: {"error": "无法创建会话"}\n\n'));
                    controller.close();
                    return;
                }

                // 创建临时订阅者来接收消息
                const subscriber = {
                    send: (msg: string) => {
                        try {
                            const parsed = JSON.parse(msg);

                            // 转换消息格式以保持 API 兼容性
                            if (parsed.type === "assistant_message") {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ content: parsed.content })}\n\n`)
                                );
                            } else if (parsed.type === "tool_use") {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({
                                        toolCall: {
                                            name: parsed.toolName,
                                            input: parsed.toolInput
                                        }
                                    })}\n\n`)
                                );
                            } else if (parsed.type === "result") {
                                // 结果消息，发送完成信号
                                controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                                controller.close();
                                // 取消订阅
                                chatSession.unsubscribe(subscriber);
                            } else if (parsed.type === "error") {
                                controller.enqueue(
                                    encoder.encode(`data: ${JSON.stringify({ error: parsed.error })}\n\n`)
                                );
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
                console.error("Chat API 错误:", error);
                controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({ error: "处理消息失败" })}\n\n`)
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

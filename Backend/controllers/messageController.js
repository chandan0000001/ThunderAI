import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import mongoose from "mongoose";
import { generateAIResponse, generateAIStreamResponse } from "../services/aiProviderService.js";
import { buildMessagesForAI } from "../utils/chatContext.js";
import { addUserTokenUsage } from "../utils/userUsage.js";
import { addChatTokenUsage } from "../utils/tokenUsage.js";
import { updateSummaryIfNeeded } from "../services/summaryService.js";
import { redisClient } from "../config/redis.js";
import { logTelemetry } from "../services/streamService.js";
import { processDocumentJob } from "../services/queueService.js";
import { inspectUploadedFile, FileSecurityError } from "../services/fileSecurityService.js";
import { searchWeb } from "../services/searchService.js";


// getMessage, sendMessage

export const getMessage = async(req,res)=>{
    try{

        const {chatId} = req.params;

        // verfiy that this chatID belongs to this user or not
        
        const chat = await Chat.findOne({
            _id: chatId,
            userId: req.user._id
        });


        if(!chat){
            return res.status(404).json({
                messages: "Chat Not found"
            });
        }


        const messages = await Message.find({
            chatId: chatId
        }).sort({createdAt:1});

        res.status(200).json({
            messages: "Your are all messages are here",
            msg: messages
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            messages: "Internal server error"
        })
    }
}



export const sendMessage = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, model, useThunderEngine = true, attachment, webSearch = false } = req.body;

    // 1. Validate message content (V-08: Length bounding)
    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Message content is required"
      });
    }

    if (content.length > 32000) {
      return res.status(400).json({
        message: "Message exceeds maximum allowed length of 32,000 characters"
      });
    }

    let chat;

    // 2. Existing chat case
    if (chatId) {
      // Check valid MongoDB ObjectId
      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Invalid chat id"
        });
      }

      chat = await Chat.findOne({
        _id: chatId,
        userId: req.user._id
      });

      if (!chat) {
        return res.status(404).json({
          message: "Chat not found"
        });
      }
    }

    // 3. New chat case
    else {
      if (!model) {
        return res.status(400).json({
          message: "Model is required for new chat"
        });
      }

      const cleanTopic = content.trim().replace(/<[^>]*>?/gm, "").slice(0, 40) || "New Conversation";
      chat = await Chat.create({
        userId: req.user._id,
        model,
        topic: cleanTopic,
      });
    }

    // Build context with optional attached document and live web grounding
    const oldMessages = await Message.find({
      chatId: chat._id,
    })
      .sort({ createdAt: 1 })
      .skip(chat.summarizedTillMessageNumber || 0);

    const userDisplayContent = attachment && attachment.fileName
      ? `[File Attached: ${attachment.fileName}]\n\n${content.trim()}`
      : content.trim();

    let promptForAI = attachment && attachment.textContent
      ? `${content.trim()}\n\n---\n[Attached Document: ${attachment.fileName || "File"}]\n${attachment.textContent}`
      : content.trim();

    if (webSearch) {
      const searchGrounding = await searchWeb(content, {
        userId: req.user?._id?.toString(),
        useThunderEngine,
      });
      if (searchGrounding) {
        promptForAI = `${promptForAI}\n\n---\n${searchGrounding}`;
      }
    }

    const messagesForAI = buildMessagesForAI({
      chat,
      oldMessages,
      currentMessage: promptForAI,
    });

    const { aiReply, usage, provider, isUserKey } = await generateAIResponse({
      model: chat.model,
      messages: messagesForAI,
      userId: req.user._id,
      useThunderEngine,
      webSearch: Boolean(webSearch),
    });

    const userMessage = await Message.create({
      chatId: chat._id,
      role: "user",
      content: userDisplayContent,
      userId: req.user._id,
    });

    // Option A: Log telemetry event to Redis Stream
    await logTelemetry("chat_sync_sent", {
      userId: req.user._id.toString(),
      chatId: chat._id.toString(),
      model: chat.model,
      hasAttachment: Boolean(attachment && attachment.textContent),
    });

    const assistantMessage = await Message.create({
      chatId: chat._id,
      role: "assistant",
      content: aiReply,
       userId: req.user._id,
       usage,
    });

    chat.messageCount += 2;

    if (chat.topic === "New Chat") {
      chat.topic = content.trim().slice(0, 40);
    }

    await addChatTokenUsage(chat, usage);
    await addUserTokenUsage(req.user, usage.totalTokens);

    // Redis token usage update (only for system key usage; BYOK is rate-limited by provider)
    let tokenUsed = 0;
    if (!isUserKey && req.tokenUsageKey) {
      tokenUsed = await redisClient.incrBy(req.tokenUsageKey, usage.totalTokens);
      if (tokenUsed === usage.totalTokens) {
        await redisClient.expire(
          req.tokenUsageKey,
          Number(process.env.TOKEN_WINDOW_SECONDS || 18000)
        );
      }
    }

    updateSummaryIfNeeded(chat._id);

    const isAdmin = req.user?.role === "admin";

    return res.status(201).json({
      message: "Message sent successfully",
      chatId: chat._id,
      reply: aiReply,
      usage,
      provider,
      isUserKey,
      tokenUsed,
      tokenLimit: (isAdmin || isUserKey) ? -1 : Number(process.env.TOKEN_LIMIT || 10000),
      isUnlimited: isAdmin || isUserKey,
      userMessage,
      assistantMessage
    });
  } catch (err) {
    console.error("SendMessage error:", err);
    res.status(500).json({
      message: err.message || "Failed to process message"
    });
  }
};

export const sendMessageStream = async (req, res) => {
  let chat = null;
  try {
    const { chatId } = req.params;
    const { content, model, useThunderEngine = true, attachment, webSearch = false } = req.body;

    // 1. Validate message content (V-08: Length bounding)
    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    if (content.length > 32000) {
      return res.status(400).json({
        message: "Message exceeds maximum allowed length of 32,000 characters",
      });
    }

    // 2. Existing chat case
    if (chatId) {
      if (!mongoose.Types.ObjectId.isValid(chatId)) {
        return res.status(400).json({
          message: "Invalid chat id",
        });
      }

      chat = await Chat.findOne({
        _id: chatId,
        userId: req.user._id,
      });

      if (!chat) {
        return res.status(404).json({
          message: "Chat not found",
        });
      }
    } else {
      // 3. New chat case
      if (!model) {
        return res.status(400).json({
          message: "Model is required for new chat",
        });
      }

      const cleanTopic = content.trim().replace(/<[^>]*>?/gm, "").slice(0, 40) || "New Conversation";
      chat = await Chat.create({
        userId: req.user._id,
        model,
        topic: cleanTopic,
      });
    }

    // Prepare context with optional attachment and live web grounding
    const oldMessages = await Message.find({
      chatId: chat._id,
    })
      .sort({ createdAt: 1 })
      .skip(chat.summarizedTillMessageNumber || 0);

    const userDisplayContent = attachment && attachment.fileName
      ? `[File Attached: ${attachment.fileName}]\n\n${content.trim()}`
      : content.trim();

    let promptForAI = attachment && attachment.textContent
      ? `${content.trim()}\n\n---\n[Attached Document: ${attachment.fileName || "File"}]\n${attachment.textContent}`
      : content.trim();

    if (webSearch) {
      const searchGrounding = await searchWeb(content, {
        userId: req.user?._id?.toString(),
        useThunderEngine,
      });
      if (searchGrounding) {
        promptForAI = `${promptForAI}\n\n---\n${searchGrounding}`;
      }
    }

    const messagesForAI = buildMessagesForAI({
      chat,
      oldMessages,
      currentMessage: promptForAI,
    });

    // Create user message in DB
    const userMessage = await Message.create({
      chatId: chat._id,
      role: "user",
      content: userDisplayContent,
      userId: req.user._id,
    });

    // Option A: Publish telemetry event to capped Redis Stream
    await logTelemetry("chat_stream_started", {
      userId: req.user._id.toString(),
      chatId: chat._id.toString(),
      model: chat.model,
      hasAttachment: Boolean(attachment && attachment.textContent),
      webSearch: Boolean(webSearch),
    });

    // Setup SSE response headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }

    // Initial start event
    res.write(
      `data: ${JSON.stringify({
        type: "start",
        chatId: chat._id,
        userMessage,
      })}\n\n`
    );

    // Stream generation from AI provider (with multi-key and provider failover)
    const { aiReply, usage, provider, isUserKey } = await generateAIStreamResponse({
      model: chat.model,
      messages: messagesForAI,
      userId: req.user._id,
      useThunderEngine,
      webSearch: Boolean(webSearch),
      onChunk: async (delta) => {
        res.write(
          `data: ${JSON.stringify({
            type: "chunk",
            chunk: delta,
          })}\n\n`
        );
      },
    });

    // Create assistant message in DB
    const assistantMessage = await Message.create({
      chatId: chat._id,
      role: "assistant",
      content: aiReply,
      userId: req.user._id,
      usage,
    });

    chat.messageCount = (chat.messageCount || 0) + 2;

    if (chat.topic === "New Chat") {
      chat.topic = content.trim().slice(0, 40);
    }

    await addChatTokenUsage(chat, usage);
    await addUserTokenUsage(req.user, usage.totalTokens);

    // Redis token usage update (only for system key usage; BYOK is rate-limited by provider)
    let tokenUsed = 0;
    if (!isUserKey && req.tokenUsageKey) {
      tokenUsed = await redisClient.incrBy(req.tokenUsageKey, usage.totalTokens);
      if (tokenUsed === usage.totalTokens) {
        await redisClient.expire(
          req.tokenUsageKey,
          Number(process.env.TOKEN_WINDOW_SECONDS || 18000)
        );
      }
    }

    const isAdmin = req.user?.role === "admin";

    // Emit done event with complete metadata
    res.write(
      `data: ${JSON.stringify({
        type: "done",
        chatId: chat._id,
        reply: aiReply,
        usage,
        provider,
        isUserKey,
        tokenUsed,
        tokenLimit: (isAdmin || isUserKey) ? -1 : Number(process.env.TOKEN_LIMIT || 10000),
        isUnlimited: isAdmin || isUserKey,
        userMessage,
        assistantMessage,
      })}\n\n`
    );

    res.end();

    updateSummaryIfNeeded(chat._id);
  } catch (err) {
    console.error("Stream error in sendMessageStream:", err);
    if (!res.headersSent) {
      return res.status(500).json({
        message: err.message || "Failed to generate AI response",
      });
    } else {
      // Save error notice in database so conversation isn't left hanging without assistant answer
      if (chat && chat._id) {
        try {
          await Message.create({
            chatId: chat._id,
            role: "assistant",
            content: `**Generation Stopped**: ${err.message || 'The AI provider encountered an error'}. Please try again or switch model provider.`,
            userId: req.user?._id,
          });
        } catch (dbErr) {
          console.warn("Could not save assistant error message:", dbErr.message);
        }
      }

      res.write(
        `data: ${JSON.stringify({
          type: "error",
          message: err.message || "Streaming interrupted",
        })}\n\n`
      );
      res.end();
    }
  }
};

/**
 * Secure Document & Image Attachment Handler via BullMQ
 * Enforces deep security scanning (Anti-Malware, Anti-Zip Bomb, Anti-Pixel Flood)
 * and memory-safe processing before queuing.
 */
export const uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No document or image attached" });
    }

    // 1. Master Security Inspection (Anti-Malware, Anti-Zip Bomb, Anti-Pixel Flood, Anti-MIME Spoofing)
    const securityResult = await inspectUploadedFile(req.file, req.user);

    // 2. Process via Option B (Memory-Optimized BullMQ Queue)
    const result = await processDocumentJob({
      fileBuffer: req.file.buffer,
      fileName: securityResult.sanitizedName,
      mimeType: securityResult.detectedMimeType,
      fileType: securityResult.fileType,
      imageMetadata: securityResult.imageMetadata || null,
      userId: req.user._id.toString(),
    });

    res.status(200).json({
      message: "File verified and processed successfully",
      fileName: result.fileName,
      fileType: securityResult.fileType,
      charCount: result.charCount,
      truncated: result.truncated,
      snippet: result.snippet,
      textContent: result.cleanText,
      dimensions: result.dimensions || null,
    });
  } catch (err) {
    if (err.isSecurityError) {
      return res.status(err.statusCode || 400).json({
        message: err.message,
        securityAlert: true,
        riskCategory: err.riskCategory,
      });
    }
    console.error("Document upload processing error:", err);
    res.status(500).json({ message: err.message || "Failed to process document attachment" });
  }
};

import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import mongoose from "mongoose";
import { generateAIResponse, generateAIStreamResponse } from "../services/openRouterService.js";
import {buildMessagesForAI} from "../utils/chatContext.js"
import {
  addUserTokenUsage,
} from "../utils/userUsage.js";
import { addChatTokenUsage } from "../utils/tokenUsage.js";
import {updateSummaryIfNeeded} from "../services/summaryService.js"
import {redisClient} from "../config/redis.js"


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
    const { content, model } = req.body;

    // 1. Validate message content
    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Message content is required"
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

      chat = await Chat.create({
        userId: req.user._id,
        model,
        topic: content.trim().slice(0, 40),
      });
    }

    

    // our code start here
    // oldMessages: Jinki abhi tak summary create nahi hui hai
    const oldMessages = await Message.find({
      chatId: chat._id,
    })
      .sort({ createdAt: 1 })
      .skip(chat.summarizedTillMessageNumber);

    const messagesForAI = buildMessagesForAI({
      chat,
      oldMessages,
      currentMessage: content.trim(),
    });

    const { aiReply, usage } = await generateAIResponse({
      model: chat.model,
      messages: messagesForAI,
    });

    const userMessage = await Message.create({
      chatId: chat._id,
      role: "user",
      content: content.trim(),
      userId: req.user._id
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

    // redis ke andar information ko daalna padega

    const tokenUsed = await redisClient.incrBy(
        req.tokenUsageKey,
        usage.totalTokens
    );

      if (tokenUsed === usage.totalTokens) {
           await redisClient.expire(
           req.tokenUsageKey,
          Number(process.env.TOKEN_WINDOW_SECONDS)
        );
      }



    updateSummaryIfNeeded(chat._id);

    return res.status(201).json({
      message: "Message sent successfully",
      chatId: chat._id,
      reply: aiReply,
      usage,
      tokenUsed,
      tokenLimit: Number(process.env.TOKEN_LIMIT),
      userMessage,
      assistantMessage
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({
      message: "Internal server error"
    });
  }
};

export const sendMessageStream = async (req, res) => {
  try {
    const { chatId } = req.params;
    const { content, model } = req.body;

    // 1. Validate message content
    if (!content || content.trim() === "") {
      return res.status(400).json({
        message: "Message content is required",
      });
    }

    let chat;

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

      chat = await Chat.create({
        userId: req.user._id,
        model,
        topic: content.trim().slice(0, 40),
      });
    }

    // Prepare context
    const oldMessages = await Message.find({
      chatId: chat._id,
    })
      .sort({ createdAt: 1 })
      .skip(chat.summarizedTillMessageNumber || 0);

    const messagesForAI = buildMessagesForAI({
      chat,
      oldMessages,
      currentMessage: content.trim(),
    });

    // Create user message in DB
    const userMessage = await Message.create({
      chatId: chat._id,
      role: "user",
      content: content.trim(),
      userId: req.user._id,
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

    // Stream generation from OpenRouter (native or fallback)
    const { aiReply, usage } = await generateAIStreamResponse({
      model: chat.model,
      messages: messagesForAI,
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

    // Redis token usage update
    let tokenUsed = 0;
    if (req.tokenUsageKey) {
      tokenUsed = await redisClient.incrBy(req.tokenUsageKey, usage.totalTokens);
      if (tokenUsed === usage.totalTokens) {
        await redisClient.expire(
          req.tokenUsageKey,
          Number(process.env.TOKEN_WINDOW_SECONDS || 18000)
        );
      }
    }

    // Emit done event with complete metadata
    res.write(
      `data: ${JSON.stringify({
        type: "done",
        chatId: chat._id,
        reply: aiReply,
        usage,
        tokenUsed,
        tokenLimit: Number(process.env.TOKEN_LIMIT || 10000),
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
        message: "Internal server error",
      });
    } else {
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

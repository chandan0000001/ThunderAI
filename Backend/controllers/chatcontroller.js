import Chat from "../model/chatSchema.js"
import Message from "../model/messageSchema.js";

// getRecentChat: , getSingleChat , createChat, deleteChat
//

// req.user = user ki information hogi// last 20 chats muje fetch karni hai

export const getRecentChat = async (req, res) => {
    try {
        const chats = await Chat.find({ userId: req.user._id })
            .select("topic updatedAt model messageCount")
            .sort({ updatedAt: -1 })
            .limit(30);

        // Filter out abandoned chats with 0 messages
        const validChats = [];
        for (const c of chats) {
            const count = await Message.countDocuments({ chatId: c._id });
            if (count > 0) {
                validChats.push(c);
            } else {
                Chat.deleteOne({ _id: c._id }).catch(() => {});
            }
        }

        res.status(200).json({
            message: "Your all recent chats",
            chats: validChats
        });
    } catch (err) {
        console.error("getRecentChat error:", err);
        res.status(500).json({
            message: "Internal server error"
        });
    }
};

export const getSingleChat = async(req,res)=>{
    try{
          
        const {chatId} = req.params;

        const chat = await Chat.findOne({_id:chatId, userId: req.user._id});

        if(!chat){
            return res.status(404).json({
                messages: "Sorry not data found"
            })
        }

        res.status(200).json({
            chatId: chat._id,
            userId: chat.userId,
            topic: chat.topic,
            usage: chat.usage
        }) 
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Interna server error"
        })
    }
}


export const createChat = async(req,res)=>{
    try{
         
        const {model} = req.body;
        // opus4.8 , sol4.2 , fkljhewqoi
        if(!model){
            return res.status(400).json({
                messages: "Model name is missing"
            })
        }

        // model name bheja hai ye valid hai ya nahi
        
        const chats = await Chat.create({
            userId: req.user._id,
            model,
        })


        res.status(201).json({
            chatId: chats._id,
            userId: req.user._id,
            model,
            topic: chats.topic,
            createdAt: chats.createdAt
        })


    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Interna server error"
        })
    }
}

export const deleteChat = async(req,res)=>{
    try{
       
        const {chatId} = req.params;

       const chat = await Chat.findOne({_id:chatId, userId: req.user._id});

       if(!chat){
            return res.status(403).json({
                message: "You are not allowed to do this"
            })
       };

        await Message.deleteMany({
            chatId: chat._id
        })

        await Chat.deleteOne({
            _id: chatId
        });

       

        res.status(200).json({
            message: "Your chat deleted successfully"
        })
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Interna server error"
        })
    }
}

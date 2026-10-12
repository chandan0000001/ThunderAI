import express from "express";
import authUserMiddleware from "../middleware/authUserMiddleware.js";
import { getRecentChat ,createChat ,getSingleChat ,deleteChat } from "../controllers/chatcontroller.js";
import loadUserMiddleware from "../middleware/loadUserMiddleware.js";
//get recent chat :  top 20 chat , getSingleChat , createChat , deleteChat
import authenticatedRateLimiter from '../middleware/authenticatedRateLimiter.js';


const chatRouter = express.Router();
chatRouter.use(authUserMiddleware); 
chatRouter.use(authenticatedRateLimiter);
chatRouter.use(loadUserMiddleware);

chatRouter.post("/createChat", createChat);
chatRouter.get("/getRecentChat", getRecentChat);
chatRouter.get("/details/:chatId", getSingleChat);
chatRouter.get("/:chatId", (req, res, next) => {
    if (req.headers.accept && req.headers.accept.includes("text/html")) {
        return next();
    }
    return getSingleChat(req, res);
});
chatRouter.delete("/:chatId", deleteChat);


export default chatRouter;
import dotenv from "dotenv/config";
import express from "express";
import connectionDB from "./config/database.js";
import  {connectRedis} from "./config/redis.js";
import userRouter from "./routes/userRouter.js";
import messageRouter from "./routes/messageRouter.js";
import chatRouter from "./routes/chatRouter.js";
import cookieParser from 'cookie-parser';
import cors from 'cors';
import {login,signup,profile,logout} from './controllers/userController.js';



// dotenv.config();


const app = express();


//for testing user
//rin this below in terminal
// 10 -d 20 http://localhost:3000/users
// app.use("/",(req,res)=>{
//     res.json("Hello ji me nahii hu")
// })

app.use(cors({
    origin: [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Cookie"]
}));
app.use(express.json());
app.use(cookieParser());

app.use("/user",userRouter) ; //userrelated jo bhi ayega ussw userrouter ko bhejj dega 
app.use("/msg", messageRouter);
app.use("/chat",chatRouter);

const startServer = async ()=>{
    try{
        await connectionDB() 
        await connectRedis();
        app.listen(process.env.PORT , ()=>{
            console.log(`Server is listening at port ${process.env.PORT}`)
        })
    }
    catch(error){
        console.log("Failed to connect Please try again");
        console.error("ERROR",error);
    }
   
} 

startServer();

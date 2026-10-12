import User from "../model/userSchema.js";
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"
import {signupSchema, loginSchema} from "../validators/userValidator.js";
import Chat from "../model/chatSchema.js";
import Message from "../model/messageSchema.js";
import { redisClient } from "../config/redis.js";

// login
// logout
// signup
// profie

const createToken = (id,email)=>{
    
    if(!process.env.JWT_SECRET){
        throw new Error("JWT Secret key is Missing");
    }

    const token =  jwt.sign({id,email}, process.env.JWT_SECRET,{expiresIn:"1h"});
    return token;
}


const cookiesOption = {
    httpOnly: true,
    secure: false,
    maxAge: 60*60*1000
}


export const signup = async (req,res)=>{
    try{
       
        // validate all this data
        
        const result = signupSchema.safeParse(req.body);

        if(!result.success){
            return res.status(400).json({
                message: result.error.issues[0].message
            })
        }



        const {name, age, email, password} = result.data;

        // https status code
        //email wala already exist toh nahi karta

       const user = await User.findOne({email});
       
       if(user){
            return res.status(409).json({
                message: "Email ID already exist"
            })
       }
       
       
       const hashPassword = await bcrypt.hash(password,12);

      const userCreated = await User.create({
        name,
        age,
        email,
        password:hashPassword
       });


       // token create karna padta:
       // _id, email: payload
      
       const token = createToken(userCreated._id, email);

       res.cookie("token",token,cookiesOption);

       res.status(201).json({
        message:"User created SuccessFully",
        name,
        age,
        email
       });

    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Internal Server error"
        })

    }
}



export const login = async (req,res)=>{
    
    try{
        
       const result = loginSchema.safeParse(req.body);
       
        if(!result.success){
            return res.status(400).json({
                message: result.error.issues[0].message
            })
        }
       

        const {email, password} = result.data;

        

        // verify the password
        const existingUser = await User.findOne({email});

        if(!existingUser){
            return res.status(401).json({message:"Invalide Credentials"})
        }
        
        // match the password

       const isMatch = await bcrypt.compare(password,existingUser.password);

       if(!isMatch)
       {
        return res.status(401).json({message:"Invalide Credentials"})
       }

       const token = createToken(existingUser._id,email);

        res.cookie("token",token,cookiesOption);

        res.status(200).json({
            message:"User Logged in SuccessFully",
            name: existingUser.name,
            age: existingUser.age,
            email: existingUser.email,
            usage: existingUser.usage
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Internal Server Error"
        });
    }

}



export const logout = async (req,res)=>{
    // logut
    try{

        if(req.token){
            const token = req.token;
            const payload = req.tokenPayload;

            const currentTime = Math.floor(Date.now() / 1000);
            const remainingTime = payload.exp - currentTime;

            if (remainingTime > 0) {
                await redisClient.set(
                    `blocklist:${token}`,
                    "blocked",
                    {
                        EX: remainingTime
                    }
                );
            }
        }

        res.clearCookie("token",{
            httpOnly: true,
            secure: false,
        })

        res.status(200).json({
            message: "User Logged Out Successfully"
        })
    }
    catch(error){
        return res.status(500).json({
            message: "Internal Server Error"
        });
    }
}




export const profile = async(req,res)=>{
    try{
        let redisTokens = 0;
        let ttl = 0;
        try {
            const key = `token-usage:${req.user._id}`;
            const val = await redisClient.get(key);
            redisTokens = Number(val || 0);
            ttl = await redisClient.ttl(key);
        } catch (e) {
            console.log("Redis token read error:", e);
        }

        res.status(200).json({
            name: req.user.name,
            age: req.user.age,
            usage: {
                totalTokenUsed: req.user.usage?.totalTokenUsed || 0,
                tokenUsed: redisTokens,
                tokenLimit: Number(process.env.TOKEN_LIMIT || 10000),
                windowSeconds: Number(process.env.TOKEN_WINDOW_SECONDS || 18000),
                ttl: ttl > 0 ? ttl : 0
            },
            email: req.user.email
        });
    }
    catch(err){
        console.log(err);
        res.status(500).json({
            message: "Internal Server error"
        });
    }
}



export const deleteAccount = async(req,res)=>{
    try{
        //find all the chat ID which belongs to the user 

        //delete all the message whic belongs to chat ID 


        //delete all the chat ID  which belongs to the user 


        //delete user profile 

        const userId = req.user._id;
          
         await Message.deleteMany({
            userId
         });
          
         await Chat.deleteMany({
              userId
         });
          
         await User.deleteOne({
                _id: userId
         });
          
      try {
        await redisClient.del(`token-usage:${userId}`);
        await redisClient.del(`rate-limit:user:${userId}`);
      } catch (redisErr) {
        console.warn("Could not delete redis keys on account purge:", redisErr);
      }

      res.clearCookie("token", {
        httpOnly: true,
        secure: false,
      });

      return res.status(200).json({
        message: "Account deleted successfully",
      });
        


    }catch(err){
        res.status(500).json({

         message:"Internation server error"
       })
    }
}

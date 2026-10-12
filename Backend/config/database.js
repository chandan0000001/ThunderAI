import mongoose from "mongoose";
const connectionDB = async ()=>{


    await mongoose.connect(process.env.MONGO_URI) ;
    console.log("connected to database sucessfully");
    


}

export default connectionDB;
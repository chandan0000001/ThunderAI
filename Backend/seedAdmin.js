import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import mongoose from "mongoose";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, ".env") });

import User from "./model/userSchema.js";

async function seedAdmin() {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is missing from Backend/.env");
    }
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to MongoDB successfully");

    const email = "kumardalaichandan803@gmail.com";
    const plainPassword = "admin#chnadan@Thunder120";
    const hashedPassword = await bcrypt.hash(plainPassword, 12);

    let user = await User.findOne({ email });
    if (user) {
      user.role = "admin";
      user.password = hashedPassword;
      user.isVerified = true;
      await user.save();
      console.log(`[SUCCESS] Updated existing user ${email} with role 'admin' and updated password.`);
    } else {
      user = await User.create({
        name: "Chandan Admin",
        email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        authProvider: "local",
      });
      console.log(`[SUCCESS] Created new user ${email} with role 'admin'.`);
    }

    await mongoose.disconnect();
    console.log("Database disconnected. Admin setup complete.");
  } catch (err) {
    console.error("Error setting up admin:", err);
    process.exit(1);
  }
}

seedAdmin();

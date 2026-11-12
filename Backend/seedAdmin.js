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

    const email = (process.env.ADMIN_EMAIL || process.env.ADMIN_EMAILS?.split(',')[0] || '').trim().toLowerCase();
    const plainPassword = process.env.ADMIN_PASSWORD || '';
    if (!email || !plainPassword) {
      throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be configured in environment (.env)");
    }
    const saltRounds = parseInt(process.env.BCRYPT_SALT_ROUNDS || process.env.BCRYPT_ROUNDS || "12", 10);
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);

    let user = await User.findOne({ email });
    if (user) {
      user.role = "admin";
      user.password = hashedPassword;
      user.isVerified = true;
      user.tokenVersion = (user.tokenVersion || 0) + 1;
      await user.save();
      console.log(`[AUDIT ${new Date().toISOString()}] Operator updated existing user ${email} to 'admin' and updated credentials.`);
    } else {
      user = await User.create({
        name: process.env.ADMIN_NAME || "System Administrator",
        email,
        password: hashedPassword,
        role: "admin",
        isVerified: true,
        tokenVersion: 0,
        authProvider: "local",
      });
      console.log(`[AUDIT ${new Date().toISOString()}] Operator created initial administrator user: ${email}.`);
    }

    await mongoose.disconnect();
    console.log("Database disconnected. Admin setup complete.");
  } catch (err) {
    console.error("Error setting up admin:", err);
    process.exit(1);
  }
}

seedAdmin();

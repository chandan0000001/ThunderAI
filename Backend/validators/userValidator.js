import { z } from "zod";

export const signupSchema = z.object({
    name: z.string().trim().min(3, "Name must be at least 3 characters").max(35, "Name must not exceed 35 characters"),
    age: z.number().min(18, "Minimum age is 18").max(99, "Maximum age is 99").optional(),
    email: z.preprocess(
        (value) => typeof value === "string" ? value.trim().toLowerCase() : "",
        z.string().email("A valid email address is required")
    ),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(30, "Password must not exceed 30 characters")
        .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
        .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
        .regex(/[0-9]/, "Password must contain at least 1 number")
        .regex(/[~!@#$%^&*():]/, "Password must contain at least 1 special character (~!@#$%^&*():)")
});

export const loginSchema = z.object({
    email: z.preprocess(
        (value) => typeof value === "string" ? value.trim().toLowerCase() : "",
        z.string().email("A valid email address is required")
    ),
    password: z.string()
        .min(8, "Password must be at least 8 characters")
        .max(30, "Password must not exceed 30 characters")
        .regex(/[A-Z]/, "Password must contain at least 1 uppercase letter")
        .regex(/[a-z]/, "Password must contain at least 1 lowercase letter")
        .regex(/[0-9]/, "Password must contain at least 1 number")
        .regex(/[~!@#$%^&*():]/, "Password must contain at least 1 special character (~!@#$%^&*():)")
});

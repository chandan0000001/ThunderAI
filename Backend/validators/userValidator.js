import {z} from "zod";

//name age email pass
export const signupSchema = z.object({
    name:z.string().trim().min(3,"Minum length of legtn is 3").max(35,"Maxm length of letter is 35"),
    age:z.number().min(18).max(99,"Max age should 100").optional(),
    email:z.preprocess(
        (value)=>typeof value == "string" ? value.trim().toLowerCase():"",
    z     .email("Email is must valid")),
     
    password:z.string().min(8).max(30).regex(/[A-Z]/,"Your password us week ").regex(/[a-z]/,"Your passwrd shoud have 1 small letter").regex(/[0-9]/,"Your password should have contain onr Number").regex(/[~!@#$%^&*():]/,"Your password shold contain a special character")
})


export const loginSchema = z.object({
    email:z.preprocess(
        (value)=>typeof value == "string" ? value.trim().toLowerCase():"",
    z.email("Email is must valid")),
     
    password:z.string().min(8).max(30).regex(/[A-Z]/,"Your password us week ").regex(/[a-z]/,"Your passwrd shoud have 1 small letter").regex(/[0-9]/,"Your password should have contain onr Number").regex(/[~!@#$%^&*():]/,"Your password shold contain a special character")
})

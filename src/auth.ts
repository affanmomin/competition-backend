import { betterAuth } from "better-auth";
import { Pool } from "pg";


export const auth = betterAuth({
    database: new Pool({
        connectionString: process.env.DATABASE_URL,
    }),
    emailAndPassword:{
        enabled: true,
    }
})

export type Session = typeof auth.$Infer.Session;
export type User = typeof auth.$Infer.Session.user;
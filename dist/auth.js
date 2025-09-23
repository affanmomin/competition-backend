"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.auth = void 0;
const better_auth_1 = require("better-auth");
const pg_1 = require("pg");
exports.auth = (0, better_auth_1.betterAuth)({
    database: new pg_1.Pool({
        connectionString: process.env.DATABASE_URL,
    }),
    emailAndPassword: {
        enabled: true,
    }
});

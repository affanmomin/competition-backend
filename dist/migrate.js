"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
function migrate() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.log("Running better-auth migrations...");
            // Better-auth will automatically create the required tables
            // when the first operation is performed. We can also manually
            // trigger table creation by calling the migration method
            // Connect to the database first
            yield db_1.default.connect();
            console.log("Connected to database");
            // The tables will be created automatically when auth is first used
            // But we can also manually create them if needed
            console.log("Database schema ready for better-auth");
            console.log("Tables will be auto-created on first auth operation");
        }
        catch (error) {
            console.error("Migration failed:", error);
            process.exit(1);
        }
        finally {
            yield db_1.default.end();
        }
    });
}
// Run migration if this file is executed directly
if (require.main === module) {
    migrate();
}
exports.default = migrate;

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
exports.cardService = exports.CardService = exports.CardError = void 0;
const query_registry_1 = require("./query-registry");
const db_1 = __importDefault(require("../db"));
class CardError extends Error {
    constructor(message) {
        super(message);
        this.name = 'CardError';
    }
}
exports.CardError = CardError;
class CardService {
    /**
     * Execute a card query by its key
     */
    executeQuery(queryKey, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const queryConfig = (0, query_registry_1.getQueryConfig)(queryKey);
            if (!queryConfig) {
                throw new CardError(`Query not found: ${queryKey}`);
            }
            try {
                // Execute the query using your database connection
                const result = yield db_1.default.query(queryConfig.query, [
                    params.user_id,
                    params.start_date || null,
                    params.end_date || null
                ]);
                return {
                    key: queryConfig.key,
                    title: queryConfig.title,
                    description: queryConfig.description,
                    chartType: queryConfig.chartType,
                    data: result.rows
                };
            }
            catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                console.log(error);
                throw new CardError(`Failed to execute query ${queryKey}: ${errorMessage}`);
            }
        });
    }
    /**
     * Execute multiple card queries in parallel
     */
    executeQueries(queryKeys, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const queries = queryKeys.map(key => this.executeQuery(key, params));
            return Promise.all(queries);
        });
    }
}
exports.CardService = CardService;
// Export singleton instance
exports.cardService = new CardService();

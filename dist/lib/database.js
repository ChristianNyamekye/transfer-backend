"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const config_1 = __importDefault(require("@/config"));
const prisma = globalThis.__prisma ||
    new client_1.PrismaClient({
        log: config_1.default.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    });
if (config_1.default.NODE_ENV === 'development') {
    globalThis.__prisma = prisma;
}
// Graceful shutdown
process.on('beforeExit', async () => {
    await prisma.$disconnect();
});
exports.default = prisma;
//# sourceMappingURL=database.js.map
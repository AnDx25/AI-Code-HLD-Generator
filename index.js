import dotenv from "dotenv";
dotenv.config();

import { cloneRepo } from "./githubFetcher.js";
import { analyseCode } from "./analyser.js";

const main = async () => {
    try {
        console.log("🚀 Starting code analysis...");
        await analyseCode();
        console.log("✅ Analysis complete. Check diagram.svg for the visual representation.");
    } catch (error) {
        console.error("❌ Error during analysis:", error.message);
    }
};

main();
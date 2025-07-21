import dotenv from "dotenv";
dotenv.config();

import { cloneRepo } from "./githubFetcher.js";
import { analyseCode } from "./analyser.js";

const main = async () => {
    const repoPath = await cloneRepo(process.env.REPO_URL);
    const mermaidDiagram = await analyseCode(repoPath, process.env.OLLAMA_MODEL);
    console.log("\n📊 Mermaid.js Output:\n", mermaidDiagram);
};

main();
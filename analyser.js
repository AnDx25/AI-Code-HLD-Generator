import { config } from "dotenv";
config();

import { ChatOllama } from "@langchain/community/chat_models/ollama";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { cloneRepo } from "./githubFetcher.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Read Java files ---
const scanDirectory = async (dir) => {
    let files = await fs.readdir(dir, { withFileTypes: true });
    let code = "";

    for (let file of files) {
        const fullPath = path.join(dir, file.name);

        if (file.isDirectory()) {
            code += await scanDirectory(fullPath);
        } else if (file.name.endsWith(".java")) {
            const content = await fs.readFile(fullPath, "utf8");
            code += `\n\n// File: ${file.name}\n${content}`;
        }
    }
    return code;
};

// --- Render Mermaid to Image ---
const renderMermaidToImage = async (inputPath, outputPath, type = 'svg') => {
    return new Promise((resolve, reject) => {
        const command = `mmdc -i ${inputPath} -o ${outputPath} -t default`;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Mermaid render error:", stderr);
                return reject(error);
            }
            console.log("📷 Mermaid diagram rendered:", outputPath);
            resolve();
        });
    });
};

// --- Main Analyzer ---
const analyseCode = async () => {
    const llm = new ChatOllama({
        model: process.env.OLLAMA_MODEL || "mistral"
    });

    const githubUrl = "https://github.com/rahulmoundekar/spring-boot-CURDRepository-Data.git"; // Ensure this is correct
    const localRepoDir = path.join(__dirname, "cloned_repo");

    await cloneRepo(githubUrl, localRepoDir);
    const code = await scanDirectory(localRepoDir);

    const prompt = `
You are a code analysis expert. Analyze the following Java Spring Boot codebase and generate:
1. A summary of what the code does.
2. A list of main modules and their responsibilities.
3. A Mermaid.js diagram to show high-level data flow between services and controllers and database.

Code:
${code.slice(0, 12000)} // Ollama token limit guard
`;

    const response = await llm.invoke(prompt);
    console.log("\n🧠 Analysis Output:\n");
    console.log(response);

    const mermaidMatch = response.content.match(/```mermaid([\s\S]*?)```/);
    if (mermaidMatch) {
        const mermaidCode = mermaidMatch[1].trim();
        const mermaidPath = path.join(__dirname, "diagram.mmd");
        const svgPath = path.join(__dirname, "diagram.svg");
        await fs.writeFile(mermaidPath, mermaidCode, "utf-8");
        console.log("✅ Mermaid diagram saved as diagram.mmd");
        await renderMermaidToImage(mermaidPath, svgPath);
    } else {
        console.warn("⚠️ No Mermaid code block found in LLM response.");
    }
};


export {
    scanDirectory,
    analyseCode
} 

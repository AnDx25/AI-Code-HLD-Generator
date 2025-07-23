import { config } from "dotenv";
config();

import { ChatOllama } from "@langchain/community/chat_models/ollama";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { exec } from "child_process";
import { cloneRepo } from "./githubFetcher.js";
import { OllamaEmbeddings } from "@langchain/community/embeddings/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

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
        // Using npx to ensure the command works even if mmdc is not in PATH
        const command = `npx @mermaid-js/mermaid-cli -i ${inputPath} -o ${outputPath} -t default` ;
        exec(command, (error, stdout, stderr) => {
            if (error) {
                console.error("❌ Mermaid render error:", stderr);
                return reject(error);
            }
            console.log("Mermaid diagram rendered:", outputPath);
            resolve();
        });
    });
};

// --- Main Analyzer ---
const analyseCode = async () => {
    const llm = new ChatOllama({
        model: process.env.OLLAMA_MODEL || "mistral", temperature: 0
    });

    const githubUrl = "https://github.com/rahulmoundekar/spring-boot-CURDRepository-Data.git"; // Ensure this is correct
    const localRepoDir = path.join(__dirname, "cloned_repo");
    //nomic-embed-text
    //await cloneRepo(githubUrl, localRepoDir);
    const code = await scanDirectory(localRepoDir);

    try {
        // Split and embed code for RAG
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 100 });
        const chunks = await splitter.createDocuments([code]);
        //Optimize embeddings and retrieval so that everytime new code is added, it does not re-embed the entire codebase

        const vectorStore = await MemoryVectorStore.fromDocuments(
            chunks,
            new OllamaEmbeddings({
                model: "mistral", // Specify the model name explicitly
                baseUrl: "http://localhost:11434" // Ensure correct URL
            })
        );

        const retriever = vectorStore.asRetriever();
        const relevantChunks = await retriever.getRelevantDocuments();
        const combinedContext = relevantChunks.map(doc => doc.pageContent).join("\n").slice(0, 12000);
        const prompt = `
You are an expert Java Spring Boot code analyst and diagram generator.

Given the following Java codebase, generate a *Mermaid sequence diagram*:
- Focus on API calls and service method interactions (Controller → Service → Repository).
- Show the request/response flow clearly.
- Be deterministic and stable across runs.
- Output ONLY Mermaid syntax inside a valid \\\mermaid\\\ code block.




Code:
${combinedContext} // Ollama token limit guard

`;

        const response = await llm.invoke(prompt);
        console.log("\n🧠 Analysis Output:\n");
        console.log(response);

        const mermaidMatch = response.content.match(/```mermaid([\s\S]*?)```/);
        if (mermaidMatch) {
            const mermaidCode = mermaidMatch[1].trim();
            const mermaidPath = path.join(__dirname, "diagram_RAG.mmd");
            const svgPath = path.join(__dirname, "diagram_RAG.svg");
            await fs.writeFile(mermaidPath, mermaidCode, "utf-8");
            console.log("✅ Mermaid diagram saved as diagram.mmd");
            await renderMermaidToImage(mermaidPath, svgPath);
        } else {
            console.warn("⚠️ No Mermaid code block found in LLM response.");
        }
        throw new Error("RAG analysis completed successfully, Now generating normal analysis...");
    } catch (error) {
        console.error("Error with embeddings or retrieval:", error.message);
        console.log("Falling back to using the entire code...");
        // Fallback to using the whole code if embeddings fail
        const combinedContext = code.slice(0, 12000);

        // Continue with the original code regardless of RAG success
        const prompt = `
You are an expert code analyst and diagram generator.

Given the following Java codebase, produce ONLY a *valid and consistent Mermaid.js class diagram*.

Requirements:
- Use sequence diagrams to represent data flow and request/response patterns for each api endpoint
- Each class will be acted as a participant in the sequence diagram
- Be deterministic and stable across runs
- Generate correct Mermaid syntax
- Do not include any other text or explanations, just the Mermaid code block


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
    }
};


export {
    scanDirectory,
    analyseCode
}
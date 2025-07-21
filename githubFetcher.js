import simpleGit from 'simple-git';
import fs from 'fs-extra';

// --- Clone Repo if Not Already Cloned ---
const cloneRepo = async (repoUrl, destPath) => {
    const git = simpleGit();
    console.log("🧪 repoUrl:", repoUrl);
    console.log("🧪 destPath:", destPath);
    console.log("typeof repoUrl:", typeof repoUrl);
    console.log("typeof destPath:", typeof destPath);
    try {
        await fs.access(destPath); // check if already cloned
        console.log("✅ Repo already cloned.");
    } catch (e) {
        try {
            // Ensure the repoUrl and destPath are passed correctly
            console.log("🔄Repo URL>>>", repoUrl);
            console.log("🔄Destination Path>>>", destPath);
            await git.clone("https://github.com/rahulmoundekar/spring-boot-CURDRepository-Data.git", destPath);
            console.log("✅ Clone successful.");
        } catch (cloneError) {
            console.error("❌ Error during cloning:", cloneError.message);
            // throw cloneError; // Re-throw the error for debugging
        }
    }
};
export { cloneRepo };
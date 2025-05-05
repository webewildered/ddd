import fs from 'fs-extra';
import path from 'path';
import simpleGit, { SimpleGit } from 'simple-git';

/**
 * Removes all files and directories inside `destDir` except the .git folder.
 */
async function cleanDest(destDir: string): Promise<void> {
  // Ensure destination exists
  await fs.ensureDir(destDir);

  const entries = await fs.readdir(destDir);
  for (const entry of entries) {
    if (entry === '.git') {
      continue;
    }
    const fullPath = path.join(destDir, entry);
    await fs.remove(fullPath);
  }
}

/**
 * Copies all files and directories from `srcDir` into `destDir`.
 */
async function copySourceToDest(srcDir: string, destDir: string): Promise<void> {
  await fs.copy(srcDir, destDir, { overwrite: true });
}

/**
 * Commits and pushes changes in the destination folder using Git.
 */
async function commitAndPush(destDir: string, message: string): Promise<void> {
  const git: SimpleGit = simpleGit(destDir);

  // Stage all changes
  await git.add('.');

  // Commit
  await git.commit(message);

  // Push to default remote and branch
  await git.push();
}

/**
 * Main deployment function.
 */
async function deploy(srcDir: string, destDir: string): Promise<void> {
  try {
    console.log(`Cleaning destination: ${destDir}`);
    await cleanDest(destDir);

    console.log(`Copying from ${srcDir} to ${destDir}`);
    await copySourceToDest(srcDir, destDir);

    console.log(`Committing and pushing changes in ${destDir}`);
    await commitAndPush(destDir, 'deploy');

    console.log('Deployment complete.');
  } catch (err) {
    console.error('Deployment failed:', err);
    process.exit(1);
  }
}

// Parse command-line arguments
const src = 'dist'
const dst = '../ddd-deploy';
deploy(src, dst);

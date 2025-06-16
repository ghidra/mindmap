// File reading utilities
async function readLocalDirectory(dirHandle) {
  const filesContent = {};
  
  async function processEntry(entry, path = '') {
    if (entry.kind === 'file') {
      const file = await entry.getFile();
      if (/\.(js|ts)$/.test(file.name)) {
        const content = await file.text();
        filesContent[path + file.name] = content;
      }
    } else if (entry.kind === 'directory') {
      for await (const child of entry.values()) {
        await processEntry(child, path + entry.name + '/');
      }
    }
  }

  await processEntry(dirHandle);
  return filesContent;
}

async function readGitHubRepo(repoUrl, token = '') {
  // Convert github.com URL to API URL
  const match = repoUrl.match(/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/);
  if (!match) throw new Error('Invalid GitHub URL');
  
  const [, owner, repo, branch = 'main'] = match;
  const filesContent = {};
  
  async function fetchContents(path = '') {
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}?ref=${branch}`;
    const headers = token ? { 'Authorization': `token ${token}` } : {};
    
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`GitHub API error: ${response.statusText}`);
    
    const contents = await response.json();
    
    for (const item of contents) {
      if (item.type === 'file' && /\.(js|ts)$/.test(item.name)) {
        const fileResponse = await fetch(item.download_url, { headers });
        if (!fileResponse.ok) continue;
        const content = await fileResponse.text();
        filesContent[path + item.name] = content;
      } else if (item.type === 'dir') {
        await fetchContents(path + item.name + '/');
      }
    }
  }
  
  await fetchContents();
  return filesContent;
}

// UI Event Handlers
document.getElementById('analyzeZipBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('zipUpload');
  if (!fileInput.files.length) {
    alert('Please upload a ZIP file first.');
    return;
  }

  const zipFile = fileInput.files[0];
  const zip = await JSZip.loadAsync(zipFile);
  const filesContent = {};

  const promises = [];
  zip.forEach((relativePath, zipEntry) => {
    if (!zipEntry.dir && /\.(js|ts)$/.test(relativePath)) {
      promises.push(
        zipEntry.async('string').then(content => {
          filesContent[relativePath] = content;
        })
      );
    }
  });

  await Promise.all(promises);
  const parsedData = parseFiles(filesContent);
  renderMindMap(parsedData);
  renderClassGraph(parsedData);
});

document.getElementById('analyzeLocalBtn').addEventListener('click', async () => {
  try {
    const dirHandle = await window.showDirectoryPicker();
    const filesContent = await readLocalDirectory(dirHandle);
    const parsedData = parseFiles(filesContent);
    renderMindMap(parsedData);
    renderClassGraph(parsedData);
  } catch (err) {
    console.error('Error reading directory:', err);
    alert('Error reading directory. Make sure you\'re using a modern browser that supports the File System Access API.');
  }
});

document.getElementById('analyzeGithubBtn').addEventListener('click', async () => {
  const repoUrl = document.getElementById('githubUrl').value.trim();
  const token = document.getElementById('githubToken').value.trim();
  
  if (!repoUrl) {
    alert('Please enter a GitHub repository URL');
    return;
  }
  
  try {
    const filesContent = await readGitHubRepo(repoUrl, token);
    const parsedData = parseFiles(filesContent);
    renderMindMap(parsedData);
    renderClassGraph(parsedData);
  } catch (err) {
    console.error('Error reading GitHub repo:', err);
    alert('Error reading GitHub repository: ' + err.message);
  }
});

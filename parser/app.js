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

  // Call your parser here
  const parsedData = parseFiles(filesContent); // You’ll define this in parser.js

  // Call your visualizer
  renderMindMap(parsedData); // You’ll define this in visualizer.js
  renderClassGraph(parsedData);

});

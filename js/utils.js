function compressImage(dataUrl, maxSize = 512, quality = 0.7) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const scale = Math.min(maxSize / width, maxSize / height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

async function compressGameImages(gameData) {
  for (const cat of (gameData.categories || [])) {
    for (const q of (cat.questions || [])) {
      if (q.image) q.image = await compressImage(q.image);
      if (q.answerImage) q.answerImage = await compressImage(q.answerImage);
    }
  }
  if (gameData.finalJeopardy && gameData.finalJeopardy.image) {
    gameData.finalJeopardy.image = await compressImage(gameData.finalJeopardy.image);
  }
  return gameData;
}

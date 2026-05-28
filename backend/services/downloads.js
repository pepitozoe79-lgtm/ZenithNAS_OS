const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const { SHARED_ROOT } = require('./files');

// Lista en memoria de tareas de descarga
let downloadTasks = [
  {
    id: 'task-1',
    name: 'ubuntu-24.04-live-server-amd64.iso',
    type: 'torrent',
    url: 'magnet:?xt=urn:btih:ubuntu-24.04',
    status: 'downloading',
    sizeTotal: 2600.0, // MB
    sizeDownloaded: 1120.0, // MB
    progress: 43,
    speed: 12.4, // MB/s
    eta: '2m 12s'
  },
  {
    id: 'task-2',
    name: 'SampleVideo_1280x720_10mb.mp4',
    type: 'direct',
    url: 'https://sample-videos.com/video321/mp4/720/big_buck_bunny_720p_10mb.mp4',
    status: 'completed',
    sizeTotal: 10.5,
    sizeDownloaded: 10.5,
    progress: 100,
    speed: 0,
    eta: 'Terminado'
  }
];

// Loop de simulación para torrents
setInterval(() => {
  downloadTasks.forEach(task => {
    if (task.status === 'downloading' && task.type === 'torrent') {
      // Incrementar descarga de torrent simulado
      const increment = Math.round((Math.random() * 5 + 2) * 10) / 10;
      task.sizeDownloaded = Math.min(task.sizeTotal, Math.round((task.sizeDownloaded + increment) * 10) / 10);
      task.progress = Math.round((task.sizeDownloaded / task.sizeTotal) * 100);
      task.speed = Math.round((Math.random() * 8 + 8) * 10) / 10; // 8-16 MB/s

      if (task.sizeDownloaded >= task.sizeTotal) {
        task.status = 'completed';
        task.progress = 100;
        task.speed = 0;
        task.eta = 'Terminado';
        
        // Crear archivo mock completado en la carpeta de descargas
        try {
          const downloadDir = path.join(SHARED_ROOT, 'Descargas');
          if (!fs.existsSync(downloadDir)) fs.mkdirSync(downloadDir, { recursive: true });
          fs.writeFileSync(path.join(downloadDir, task.name), 'Contenido simulado del torrent descargado con éxito.');
        } catch (e) {
          console.error(e);
        }
      } else {
        const remainingMb = task.sizeTotal - task.sizeDownloaded;
        const seconds = Math.round(remainingMb / task.speed);
        if (seconds > 60) {
          task.eta = `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        } else {
          task.eta = `${seconds}s`;
        }
      }
    }
  });
}, 2000);

/**
 * Obtener lista de descargas.
 */
function getDownloads() {
  return downloadTasks;
}

/**
 * Agrega una nueva descarga (Soporta Direct URL y Magnet links).
 */
function addDownload(url) {
  const isMagnet = url.startsWith('magnet:') || url.endsWith('.torrent');
  const taskId = 'task-' + Date.now();
  
  if (isMagnet) {
    // Añadir Torrent Simulado
    const name = url.startsWith('magnet:') 
      ? 'Torrent_Descarga_' + taskId.substring(5) + '.zip'
      : path.basename(url);

    const newTask = {
      id: taskId,
      name: name,
      type: 'torrent',
      url: url,
      status: 'downloading',
      sizeTotal: 650.0, // Tamaño por defecto para el mock
      sizeDownloaded: 0,
      progress: 0,
      speed: 5.2,
      eta: 'Calculando...'
    };
    downloadTasks.push(newTask);
    return { success: true, message: 'Descarga de Torrent agregada con éxito.', task: newTask };
  } else {
    // Descarga Directa Real por HTTP/HTTPS
    let name = 'Descarga_' + taskId.substring(5);
    try {
      const parsedUrl = new URL(url);
      const filename = path.basename(parsedUrl.pathname);
      if (filename) name = filename;
    } catch (e) {
      // Usar nombre por defecto
    }

    const newTask = {
      id: taskId,
      name: name,
      type: 'direct',
      url: url,
      status: 'downloading',
      sizeTotal: 0, // Se actualizará al recibir headers
      sizeDownloaded: 0,
      progress: 0,
      speed: 0,
      eta: 'Conectando...'
    };
    
    downloadTasks.push(newTask);
    
    // Iniciar hilo de descarga asíncrono real
    startRealDownload(newTask.id, url, name);
    
    return { success: true, message: 'Descarga directa iniciada en segundo plano.', task: newTask };
  }
}

/**
 * Realiza la descarga real por HTTP/HTTPS a disco.
 */
function startRealDownload(taskId, url, filename) {
  const task = downloadTasks.find(t => t.id === taskId);
  if (!task) return;

  const downloadDir = path.join(SHARED_ROOT, 'Descargas');
  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }
  const filePath = path.join(downloadDir, filename);

  const client = url.startsWith('https') ? https : http;
  
  let startTime = Date.now();
  let lastBytes = 0;

  const req = client.get(url, (res) => {
    if (res.statusCode !== 200) {
      task.status = 'failed';
      task.eta = 'Error HTTP ' + res.statusCode;
      return;
    }

    const totalBytes = parseInt(res.headers['content-length'] || '0');
    task.sizeTotal = Math.round((totalBytes / (1024 * 1024)) * 10) / 10; // MB

    const fileStream = fs.createWriteStream(filePath);
    res.pipe(fileStream);

    let downloadedBytes = 0;

    res.on('data', (chunk) => {
      downloadedBytes += chunk.length;
      task.sizeDownloaded = Math.round((downloadedBytes / (1024 * 1024)) * 10) / 10; // MB
      
      if (task.sizeTotal > 0) {
        task.progress = Math.round((downloadedBytes / totalBytes) * 100);
      } else {
        task.progress = 50; // Progreso indefinido
      }

      // Medición de velocidad cada segundo
      const now = Date.now();
      const elapsed = (now - startTime) / 1000;
      if (elapsed >= 1.0) {
        const bytesDiff = downloadedBytes - lastBytes;
        task.speed = Math.round((bytesDiff / (1024 * 1024) / elapsed) * 10) / 10; // MB/s
        
        if (task.sizeTotal > 0 && task.speed > 0) {
          const remainingMb = task.sizeTotal - task.sizeDownloaded;
          const remainingSecs = remainingMb / task.speed;
          task.eta = remainingSecs > 60 
            ? `${Math.floor(remainingSecs / 60)}m ${Math.round(remainingSecs % 60)}s` 
            : `${Math.round(remainingSecs)}s`;
        } else {
          task.eta = 'Calculando...';
        }

        startTime = now;
        lastBytes = downloadedBytes;
      }
    });

    fileStream.on('finish', () => {
      fileStream.close();
      task.status = 'completed';
      task.progress = 100;
      task.sizeDownloaded = task.sizeTotal || task.sizeDownloaded;
      task.speed = 0;
      task.eta = 'Terminado';
    });

    fileStream.on('error', (err) => {
      task.status = 'failed';
      task.eta = err.message;
    });
  });

  req.on('error', (err) => {
    task.status = 'failed';
    task.eta = err.message;
  });
}

/**
 * Pausa o reanuda una descarga.
 */
function toggleTask(id) {
  const task = downloadTasks.find(t => t.id === id);
  if (!task) return { success: false, message: 'Tarea no encontrada.' };

  if (task.status === 'downloading') {
    task.status = 'paused';
    task.speed = 0;
    task.eta = 'Pausado';
  } else if (task.status === 'paused') {
    task.status = 'downloading';
    task.eta = 'Calculando...';
  }

  return { success: true, task };
}

/**
 * Elimina una tarea de descarga.
 */
function removeTask(id) {
  const index = downloadTasks.findIndex(t => t.id === id);
  if (index !== -1) {
    const removed = downloadTasks.splice(index, 1);
    return { success: true, message: `Descarga "${removed[0].name}" eliminada.` };
  }
  return { success: false, message: 'Tarea no encontrada.' };
}

module.exports = {
  getDownloads,
  addDownload,
  toggleTask,
  removeTask
};

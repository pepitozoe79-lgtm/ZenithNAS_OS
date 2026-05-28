const express = require('express');
const cors = require('cors');
const path = require('path');

const systemService = require('./services/system');
const storageService = require('./services/storage');
const dockerService = require('./services/docker');
const filesService = require('./services/files');
const downloadsService = require('./services/downloads');

// Cargar configuración persistente del NAS
const sysConfig = systemService.loadConfig();

const app = express();
const PORT = process.env.PORT || sysConfig.port || 5000;

// Configuración inicial del servidor
app.use(cors());
app.use(express.json());

// Inicializar carpetas compartidas del NAS
filesService.initializeShares();

// Servir archivos estáticos del frontend desde la raíz o ruta /dsm
app.use(express.static(path.join(__dirname, '../frontend')));

// ==========================================
// RUTAS DE LA API DEL SISTEMA
// ==========================================

// Obtener información de hardware y SO estática
app.get('/api/system/static', async (req, res) => {
  try {
    const staticInfo = await systemService.getStaticInfo();
    res.json(staticInfo);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener estadísticas de uso en tiempo real (CPU, RAM, Red, Temp)
app.get('/api/system/stats', async (req, res) => {
  try {
    const stats = await systemService.getRealtimeStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar zona horaria del servidor
app.post('/api/system/timezone', async (req, res) => {
  const { timezone } = req.body;
  if (!timezone) return res.status(400).json({ error: 'Falta la zona horaria.' });
  try {
    const result = await systemService.setTimezone(timezone);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar configuración de red (IP Estática / DHCP)
app.post('/api/system/network', async (req, res) => {
  try {
    const result = await systemService.setNetworkSettings(req.body);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Habilitar/Deshabilitar Samba
app.post('/api/system/samba', async (req, res) => {
  const { enabled } = req.body;
  if (enabled === undefined) return res.status(400).json({ error: 'Falta el estado enabled.' });
  try {
    const result = await systemService.setSambaEnabled(enabled);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cambiar puerto del servidor
app.post('/api/system/port', async (req, res) => {
  const { port } = req.body;
  if (!port) return res.status(400).json({ error: 'Falta el puerto.' });
  try {
    const result = await systemService.setPanelPort(port);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS DE LA API DE ALMACENAMIENTO
// ==========================================

// Obtener estado de discos y volúmenes montados
app.get('/api/storage/stats', async (req, res) => {
  try {
    const storageStats = await storageService.getStorageStats();
    res.json(storageStats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Escanear dispositivos USB conectados no montados
app.get('/api/storage/usb/unmounted', async (req, res) => {
  try {
    const devices = await storageService.getUnmountedUSBDevices();
    res.json(devices);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Montar un dispositivo USB
app.post('/api/storage/usb/mount', async (req, res) => {
  const { dev, folderName } = req.body;
  if (!dev || !folderName) return res.status(400).json({ error: 'Faltan parámetros dev y folderName.' });
  try {
    const result = await storageService.mountUSBDevice(dev, folderName);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Formatear un dispositivo USB
app.post('/api/storage/usb/format', async (req, res) => {
  const { dev, fsType } = req.body;
  if (!dev || !fsType) return res.status(400).json({ error: 'Faltan parámetros dev y fsType.' });
  try {
    const result = await storageService.formatUSBDevice(dev, fsType);
    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS DE LA API DE CONTENEDORES DOCKER (Package Center)
// ==========================================

// Listar contenedores
app.get('/api/docker/containers', async (req, res) => {
  try {
    const containers = await dockerService.getContainers();
    res.json(containers);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Iniciar un contenedor
app.post('/api/docker/start', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID del contenedor.' });
  try {
    const result = await dockerService.startContainer(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Detener un contenedor
app.post('/api/docker/stop', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID del contenedor.' });
  try {
    const result = await dockerService.stopContainer(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Eliminar un contenedor (Desinstalar app)
app.post('/api/docker/remove', async (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID del contenedor.' });
  try {
    const result = await dockerService.removeContainer(id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Instalar una nueva aplicación Docker (Package Center)
app.post('/api/docker/install', async (req, res) => {
  const { packageKey } = req.body;
  if (!packageKey) return res.status(400).json({ error: 'Falta la clave de aplicación (packageKey).' });
  try {
    const result = await dockerService.installPackage(packageKey);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// RUTAS DE LA API DE ARCHIVOS (File Station)
// ==========================================

// Listar archivos
app.get('/api/files/list', (req, res) => {
  const relativePath = req.query.path || '';
  const result = filesService.listFiles(relativePath);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Crear una carpeta
app.post('/api/files/create-folder', (req, res) => {
  const { path: relativePath, name } = req.body;
  if (!name) return res.status(400).json({ error: 'Falta el nombre de la carpeta.' });
  const result = filesService.createFolder(relativePath || '', name);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Eliminar un archivo o carpeta
app.post('/api/files/delete', (req, res) => {
  const { path: relativePath } = req.body;
  if (!relativePath) return res.status(400).json({ error: 'Falta la ruta del elemento.' });
  const result = filesService.deleteItem(relativePath);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Escribir/Guardar un archivo creado o simulado por subida
app.post('/api/files/upload', (req, res) => {
  const { path: relativePath, name, content } = req.body;
  if (!name) return res.status(400).json({ error: 'Falta el nombre del archivo.' });
  const result = filesService.saveFile(relativePath || '', name, content);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// ==========================================
// RUTAS DE LA API DE DESCARGAS (Download Station)
// ==========================================

// Listar descargas activas y completadas
app.get('/api/downloads/list', (req, res) => {
  res.json(downloadsService.getDownloads());
});

// Agregar una descarga (Magnet link o URL directa)
app.post('/api/downloads/add', (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Falta la URL de descarga.' });
  const result = downloadsService.addDownload(url);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Pausar o reanudar una descarga
app.post('/api/downloads/toggle', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID de la descarga.' });
  const result = downloadsService.toggleTask(id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Eliminar una tarea de descarga
app.post('/api/downloads/remove', (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: 'Falta el ID de la descarga.' });
  const result = downloadsService.removeTask(id);
  if (result.success) {
    res.json(result);
  } else {
    res.status(400).json(result);
  }
});

// Redirigir cualquier otra petición de página al frontend (Single Page Application fallback)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`=====================================================================`);
  console.log(`🚀 ZENITHNAS OS - EL ÁPICE DEL ALMACENAMIENTO DIY`);
  console.log(`💻 Localhost: http://localhost:${PORT}`);
  console.log(`📂 Carpeta compartida raíz: ${filesService.SHARED_ROOT}`);
  console.log(`⚙️  Modo Operativo: ${process.platform === 'linux' ? 'Producción Real (Linux)' : 'Simulación de Desarrollo (Windows)'}`);
  console.log(`=====================================================================`);
});

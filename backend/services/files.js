const fs = require('fs');
const path = require('path');
const os = require('os');

// Definir directorio base para carpetas compartidas
let SHARED_ROOT = '';
if (process.platform === 'win32') {
  SHARED_ROOT = path.join('C:', 'Users', 'Admin', 'Desktop', 'NAS', 'shares');
} else {
  SHARED_ROOT = '/srv/nas/shares';
}

// Inicializar y crear estructura inicial de carpetas
function initializeShares() {
  try {
    if (!fs.existsSync(SHARED_ROOT)) {
      fs.mkdirSync(SHARED_ROOT, { recursive: true });
    }

    // Crear algunas carpetas por defecto si está vacío
    const defaultFolders = ['Videos', 'Documentos', 'Descargas', 'Fotos'];
    defaultFolders.forEach(folder => {
      const folderPath = path.join(SHARED_ROOT, folder);
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath);
      }
    });

    // Agregar un archivo de bienvenida por defecto
    const readmePath = path.join(SHARED_ROOT, 'Bienvenido_al_NAS.txt');
    if (!fs.existsSync(readmePath)) {
      fs.writeFileSync(readmePath, `=====================================================
¡Bienvenido a tu servidor NAS con estilo DSM en Ubuntu 24.04!
=====================================================

Esta es la carpeta compartida raíz. Todo lo que guardes aquí
estará disponible a través de la interfaz de File Station.

Puedes crear directorios, borrar archivos o subir nuevos
documentos directamente desde el navegador web.

Disfruta de la experiencia premium estilo Synology DSM.
`, 'utf8');
    }
  } catch (error) {
    console.error('Error al inicializar carpetas compartidas:', error);
  }
}

// Resolver ruta relativa asegurando que no se pueda hacer "Directory Traversal" fuera de la raíz
function resolveSafePath(relativeUrlPath = '') {
  // Eliminar caracteres peligrosos
  const cleanRelative = path.normalize(relativeUrlPath).replace(/^(\.\.(\/|\\|$))+/, '');
  const absolutePath = path.join(SHARED_ROOT, cleanRelative);

  // Asegurar que comience con la ruta raíz
  if (!absolutePath.startsWith(SHARED_ROOT)) {
    throw new Error('Acceso denegado: Intento de salir de la raíz compartida.');
  }

  return absolutePath;
}

/**
 * Lista los archivos y carpetas de una ruta.
 */
function listFiles(relativeUrlPath = '') {
  try {
    const targetPath = resolveSafePath(relativeUrlPath);
    if (!fs.existsSync(targetPath)) {
      return { success: false, message: 'La ruta no existe.' };
    }

    const stat = fs.statSync(targetPath);
    if (!stat.isDirectory()) {
      return { success: false, message: 'La ruta especificada no es un directorio.' };
    }

    const items = fs.readdirSync(targetPath);
    const fileList = items.map(name => {
      const fullPath = path.join(targetPath, name);
      const itemStat = fs.statSync(fullPath);
      
      return {
        name,
        isDirectory: itemStat.isDirectory(),
        size: itemStat.isDirectory() ? 0 : Math.round(itemStat.size / 1024 * 10) / 10, // KB
        modified: itemStat.mtime.toLocaleString(),
        path: path.relative(SHARED_ROOT, fullPath).replace(/\\/g, '/')
      };
    });

    // Ordenar: primero carpetas, luego archivos
    fileList.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return {
      success: true,
      currentPath: relativeUrlPath.replace(/\\/g, '/'),
      items: fileList
    };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Crea una nueva carpeta en una ruta.
 */
function createFolder(relativeUrlPath, folderName) {
  try {
    const targetPath = resolveSafePath(relativeUrlPath);
    const newFolderPath = path.join(targetPath, folderName);

    // Seguridad extra
    if (!newFolderPath.startsWith(SHARED_ROOT)) {
      return { success: false, message: 'Ruta inválida.' };
    }

    if (fs.existsSync(newFolderPath)) {
      return { success: false, message: 'La carpeta ya existe.' };
    }

    fs.mkdirSync(newFolderPath);
    return { success: true, message: `Carpeta "${folderName}" creada.` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Elimina un archivo o carpeta.
 */
function deleteItem(relativeUrlPath) {
  try {
    const targetPath = resolveSafePath(relativeUrlPath);

    if (targetPath === SHARED_ROOT) {
      return { success: false, message: 'No se puede eliminar la carpeta raíz compartida.' };
    }

    if (!fs.existsSync(targetPath)) {
      return { success: false, message: 'El elemento no existe.' };
    }

    const stat = fs.statSync(targetPath);
    if (stat.isDirectory()) {
      fs.rmSync(targetPath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(targetPath);
    }

    return { success: true, message: 'Elemento eliminado con éxito.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

/**
 * Escribe un archivo mock o real subido.
 */
function saveFile(relativeUrlPath, fileName, contentString) {
  try {
    const targetDir = resolveSafePath(relativeUrlPath);
    const filePath = path.join(targetDir, fileName);

    fs.writeFileSync(filePath, contentString || 'Archivo vacío', 'utf8');
    return { success: true, message: `Archivo "${fileName}" guardado con éxito.` };
  } catch (error) {
    return { success: false, message: error.message };
  }
}

module.exports = {
  initializeShares,
  listFiles,
  createFolder,
  deleteItem,
  saveFile,
  SHARED_ROOT
};

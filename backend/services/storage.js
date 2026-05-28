const si = require('systeminformation');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

// Variable global para simulación de dispositivo USB desconectado/conectado
let simulatedUSB = {
  dev: '/dev/sdf1',
  name: 'SanDisk Ultra USB 3.0',
  size: 64.0, // GB
  fsType: 'exfat',
  mounted: false,
  mountPoint: null
};

/**
 * Obtiene información de volúmenes de almacenamiento (montajes/particiones).
 */
async function getStorageStats() {
  try {
    const fsSizes = await si.fsSize();
    const diskLayout = await si.diskLayout();

    // 1. Filtrar sistemas de archivos relevantes (omitir tmpfs, devtmpfs, loopbacks, etc. en Linux)
    const activeMounts = fsSizes
      .filter(fs => {
        // En Linux omitimos loops y mounts de sistema
        if (fs.type === 'tmpfs' || fs.type === 'devtmpfs' || fs.type === 'squashfs') return false;
        if (fs.mount.startsWith('/boot') || fs.mount.startsWith('/sys') || fs.mount.startsWith('/proc') || fs.mount.startsWith('/dev')) return false;
        return true;
      })
      .map(fs => ({
        fs: fs.fs,
        type: fs.type,
        size: Math.round(fs.size / (1024 * 1024 * 1024) * 10) / 10, // GB
        used: Math.round(fs.used / (1024 * 1024 * 1024) * 10) / 10, // GB
        available: Math.round(fs.available / (1024 * 1024 * 1024) * 10) / 10, // GB
        usePercent: Math.round(fs.use),
        mount: fs.mount
      }));

    // Inyectar USB simulado si está montado
    if (simulatedUSB.mounted && !activeMounts.some(m => m.fs === simulatedUSB.dev)) {
      activeMounts.push({
        fs: simulatedUSB.dev,
        type: simulatedUSB.fsType,
        size: simulatedUSB.size,
        used: 12.4,
        available: simulatedUSB.size - 12.4,
        usePercent: Math.round((12.4 / simulatedUSB.size) * 100),
        mount: simulatedUSB.mountPoint
      });
    }

    // 2. Obtener discos físicos conectados
    const physicalDisks = diskLayout.map(disk => ({
      name: disk.name,
      vendor: disk.vendor || 'Generic',
      model: disk.model,
      serial: disk.serialNum || 'N/A',
      size: Math.round(disk.size / (1024 * 1024 * 1024) * 10) / 10, // GB
      type: disk.type || (disk.size < 600000000000 ? 'SSD' : 'HDD'), 
      interface: disk.interfaceType || 'SATA'
    }));

    // Si no hay montajes detectados (ej. en desarrollo en Windows sin mounts tipo ext4), proveer mocks elegantes
    if (activeMounts.length === 0) {
      activeMounts.push({
        fs: '/dev/sda2',
        type: 'ext4',
        size: 512.0,
        used: 120.5,
        available: 391.5,
        usePercent: 24,
        mount: '/'
      }, {
        fs: '/dev/sdb1',
        type: 'btrfs',
        size: 2048.0,
        used: 850.2,
        available: 1197.8,
        usePercent: 41,
        mount: '/srv/nas/shares'
      }, {
        fs: '/dev/sdc1',
        type: 'ntfs', 
        size: 4000.0,
        used: 2850.0,
        available: 1150.0,
        usePercent: 71,
        mount: '/media/externo_ntfs'
      }, {
        fs: '/dev/sdd1',
        type: 'exfat', 
        size: 256.0,
        used: 48.2,
        available: 207.8,
        usePercent: 19,
        mount: '/media/pendrive_exfat'
      }, {
        fs: '/dev/sde1',
        type: 'vfat', 
        size: 64.0,
        used: 35.5,
        available: 28.5,
        usePercent: 55,
        mount: '/media/datos_fat32'
      });
      
      // Agregar USB simulado si el usuario lo montó
      if (simulatedUSB.mounted) {
        activeMounts.push({
          fs: simulatedUSB.dev,
          type: simulatedUSB.fsType,
          size: simulatedUSB.size,
          used: 4.8,
          available: simulatedUSB.size - 4.8,
          usePercent: Math.round((4.8 / simulatedUSB.size) * 100),
          mount: simulatedUSB.mountPoint
        });
      }
    }

    if (physicalDisks.length === 0) {
      physicalDisks.push({
        name: 'SATA Drive 1',
        vendor: 'Western Digital',
        model: 'WD Red Pro WD4003FFBX',
        serial: 'WD-WCC7K4EXXYZ1',
        size: 4000.0,
        type: 'HDD',
        interface: 'SATA'
      }, {
        name: 'SATA Drive 2',
        vendor: 'Crucial',
        model: 'Crucial MX500 SSD',
        serial: 'CT1000MX500SSD1',
        size: 1000.0,
        type: 'SSD',
        interface: 'SATA'
      }, {
        name: 'USB External 1',
        vendor: 'Seagate',
        model: 'Expansion Portable Drive',
        serial: 'SG-NA123456',
        size: 4000.0,
        type: 'HDD',
        interface: 'USB'
      });

      if (simulatedUSB.mounted || !simulatedUSB.mounted) {
        physicalDisks.push({
          name: simulatedUSB.dev.replace('/dev/', ''),
          vendor: 'SanDisk',
          model: simulatedUSB.name,
          serial: 'SD-ULTRA999',
          size: simulatedUSB.size,
          type: 'SSD',
          interface: 'USB'
        });
      }
    }

    return {
      mounts: activeMounts,
      disks: physicalDisks,
      health: 'Sano'
    };
  } catch (error) {
    console.error('Error al obtener estadísticas de almacenamiento:', error);
    return {
      mounts: [{ fs: '/dev/sda2', type: 'ext4', size: 512.0, used: 120.5, available: 391.5, usePercent: 24, mount: '/' }],
      disks: [{ name: 'SATA Drive 1', vendor: 'WD', model: 'WD Red 4TB', serial: 'N/A', size: 4000.0, type: 'HDD', interface: 'SATA' }],
      health: 'Sano (Simulado)'
    };
  }
}

/**
 * Escanea dispositivos USB conectados que NO estén montados.
 */
function getUnmountedUSBDevices() {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') {
      // Simulación en Windows: devuelve el USB simulado si no está montado
      return resolve(simulatedUSB.mounted ? [] : [simulatedUSB]);
    }

    // En Linux ejecutamos lsblk filtrando por USB no montados
    exec('lsblk -o NAME,FSTYPE,SIZE,MOUNTPOINT,MODEL,TRAN -J', (error, stdout) => {
      if (error) {
        return resolve([]);
      }

      try {
        const data = JSON.parse(stdout);
        const unmountedUsb = [];

        if (data.blockdevices) {
          data.blockdevices.forEach(dev => {
            // Unidades USB
            if (dev.tran === 'usb') {
              if (dev.children) {
                dev.children.forEach(child => {
                  if (!child.mountpoint) {
                    unmountedUsb.push({
                      dev: `/dev/${child.name}`,
                      name: dev.model || 'Dispositivo USB Genérico',
                      size: parseFloat(child.size) || 16.0,
                      fsType: child.fstype || 'Desconocido',
                      mounted: false,
                      mountPoint: null
                    });
                  }
                });
              } else if (!dev.mountpoint) {
                unmountedUsb.push({
                  dev: `/dev/${dev.name}`,
                  name: dev.model || 'Dispositivo USB Genérico',
                  size: parseFloat(dev.size) || 16.0,
                  fsType: dev.fstype || 'Desconocido',
                  mounted: false,
                  mountPoint: null
                });
              }
            }
          });
        }
        resolve(unmountedUsb);
      } catch (e) {
        resolve([]);
      }
    });
  });
}

/**
 * Monta un dispositivo en un subdirectorio de shares
 */
function mountUSBDevice(dev, folderName) {
  return new Promise((resolve) => {
    // Definir ruta base de shares
    let SHARED_ROOT = '';
    if (process.platform === 'win32') {
      SHARED_ROOT = path.join('C:', 'Users', 'Admin', 'Desktop', 'NAS', 'shares');
    } else {
      SHARED_ROOT = '/srv/nas/shares';
    }

    const mountPath = path.join(SHARED_ROOT, folderName);

    if (process.platform !== 'linux') {
      // Simulación en Windows
      if (dev === simulatedUSB.dev) {
        simulatedUSB.mounted = true;
        simulatedUSB.mountPoint = mountPath;

        // Crear carpeta física e inyectar archivos simulados
        if (!fs.existsSync(mountPath)) {
          fs.mkdirSync(mountPath, { recursive: true });
        }
        fs.writeFileSync(path.join(mountPath, 'Mis_Documentos_USB.txt'), 'Archivos leídos con éxito de tu pendrive USB.');
        fs.writeFileSync(path.join(mountPath, 'Bienvenido.txt'), 'Este disco NTFS/exFAT se montó correctamente.');
        
        return resolve({ success: true, message: `Dispositivo simulado montado en shares/${folderName}` });
      }
      return resolve({ success: false, message: 'Dispositivo no encontrado.' });
    }

    // En Linux, montaje real
    // 1. Crear directorio
    if (!fs.existsSync(mountPath)) {
      fs.mkdirSync(mountPath, { recursive: true });
    }

    // 2. Intentar montar (usando ntfs-3g para ntfs, o mount genérico)
    // Usamos uid y gid para que Node.js y Samba puedan leer/escribir sin problemas
    const cmd = `sudo mount -o uid=1000,gid=1000 ${dev} ${mountPath}`;
    exec(cmd, (mountError) => {
      if (mountError) {
        // Tratar de montar sin opciones en caso de fallar (ej. ext4 no soporta uid)
        exec(`sudo mount ${dev} ${mountPath}`, (err2) => {
          if (err2) {
            resolve({ success: false, error: err2.message });
          } else {
            resolve({ success: true, message: `Dispositivo montado en shares/${folderName}` });
          }
        });
      } else {
        resolve({ success: true, message: `Dispositivo montado en shares/${folderName}` });
      }
    });
  });
}

/**
 * Formatea un dispositivo USB con un sistema de archivos específico.
 */
function formatUSBDevice(dev, fsType) {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') {
      // Simulación en Windows
      if (dev === simulatedUSB.dev) {
        // Desmontar si estaba montado
        simulatedUSB.mounted = false;
        simulatedUSB.mountPoint = null;
        simulatedUSB.fsType = fsType;
        
        // Simular retardo de formateo (2s)
        setTimeout(() => {
          resolve({ success: true, message: `Dispositivo formateado a ${fsType} con éxito (simulado).` });
        }, 2000);
        return;
      }
      return resolve({ success: false, message: 'Dispositivo no encontrado.' });
    }

    // En Linux
    // 1. Asegurar desmontaje previo por seguridad
    exec(`sudo umount -f ${dev}`, () => {
      let formatCmd = '';
      
      switch (fsType.toLowerCase()) {
        case 'ext4':
          formatCmd = `sudo mkfs.ext4 -F ${dev}`;
          break;
        case 'ntfs':
          formatCmd = `sudo mkfs.ntfs -F ${dev}`;
          break;
        case 'exfat':
          formatCmd = `sudo mkfs.exfat ${dev}`;
          break;
        case 'vfat':
        case 'fat32':
          formatCmd = `sudo mkfs.vfat -F 32 ${dev}`;
          break;
        default:
          return resolve({ success: false, error: 'Sistema de archivos no soportado para formateo.' });
      }

      // 2. Ejecutar comando de formateo
      exec(formatCmd, (error) => {
        if (error) {
          resolve({ success: false, error: error.message });
        } else {
          resolve({ success: true, message: `Dispositivo formateado a ${fsType} con éxito.` });
        }
      });
    });
  });
}

module.exports = {
  getStorageStats,
  getUnmountedUSBDevices,
  mountUSBDevice,
  formatUSBDevice
};

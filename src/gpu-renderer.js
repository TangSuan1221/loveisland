import { WebGPURenderer } from 'three/webgpu';

// All active views share the WebGPU renderer path. Never silently claim that
// a WebGL fallback is WebGPU: a missing adapter is an actionable startup error.
export async function createGPURenderer(options = {}) {
  if (!navigator.gpu) throw new Error('当前浏览器未开放 WebGPU。请在开启硬件加速的新版 Chrome 或 Edge 中打开游戏。');
  const renderer = new WebGPURenderer({ antialias: true, ...options });
  const dispose = renderer.dispose.bind(renderer);
  let disposed = false;
  renderer.dispose = () => {
    if (disposed) return;
    disposed = true;
    renderer.onDeviceLost = () => {}; // Intentional teardown is not device failure.
    dispose();
    renderer.backend.context?.unconfigure?.();
    // r180 Backend.dispose is empty. Release devices owned by short-lived views.
    if (!options.device) renderer.backend.device?.destroy();
  };
  try {
    await renderer.init();
    if (!renderer.backend.isWebGPUBackend) throw new Error('WebGPU 设备初始化失败，请检查浏览器硬件加速与显卡驱动。');
    renderer.domElement.dataset.backend = 'webgpu';
    return renderer;
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}

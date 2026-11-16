import { WebGPURenderer } from 'three/webgpu';

// Keep the node-material renderer on both backends so actors and events share
// one shading pipeline when the browser offers WebGL2 without a WebGPU adapter.
export async function createGPURenderer(options = {}) {
  const renderer = new WebGPURenderer({ antialias: true, forceWebGL: !navigator.gpu, ...options });
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
    renderer.domElement.dataset.backend = renderer.backend.isWebGPUBackend ? 'webgpu' : 'webgl2';
    return renderer;
  } catch (error) {
    renderer.dispose();
    throw error;
  }
}


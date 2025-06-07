import React, { Suspense, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, useGLTF } from '@react-three/drei';

interface AnimatedAvatarProps {
  talking: boolean;
}

function AvatarModel({ talking }: { talking: boolean }) {
  const group = useRef<any>();
  const gltf = useGLTF('/avatar.glb');

  useFrame(() => {
    if (group.current) {
      const t = Date.now() * 0.001;
      const scaleY = 1 + 0.005 * Math.sin(t * 0.5);
      const y = 0.005 * Math.sin(t * 0.5 + 1.5);
      group.current.scale.set(1, scaleY, 1);
      group.current.position.y = y;
    }
    if (gltf.scene && gltf.scene.traverse) {
      gltf.scene.traverse((obj: any) => {
        if (obj.morphTargetDictionary && obj.morphTargetInfluences) {
          // Sonrisa permanente
          const smileKeys = ['mouthSmile', 'mouthSmileLeft', 'mouthSmileRight', 'mouth_smile', 'mouthHappy', 'mouth_smileLeft', 'mouth_smileRight'];
          for (const key of smileKeys) {
            const idx = obj.morphTargetDictionary[key];
            if (idx !== undefined) {
              obj.morphTargetInfluences[idx] = 1;
            }
          }
          // Animación de boca hablando SOLO si talking es true
          const mouthKeys = ['mouthOpen', 'mouthOpen_vrm', 'MouthOpen', 'mouthA', 'mouth', 'jawOpen', 'viseme_aa'];
          for (const key of mouthKeys) {
            const idx = obj.morphTargetDictionary[key];
            if (idx !== undefined) {
              obj.morphTargetInfluences[idx] = talking ? 1 * Math.abs(Math.sin(Date.now() * 0.003)) : 0;
            }
          }
        }
      });
    }
  });

  return <group ref={group}><primitive object={gltf.scene} /></group>;
}

const AnimatedAvatar: React.FC<AnimatedAvatarProps> = ({ talking }) => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        minHeight: '100vh',
        minWidth: '100vw',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'fixed',
        top: 0,
        left: 0,
        background: 'transparent',
        zIndex: 1,
      }}
    >
      {/* Círculo de fondo grande */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '90vw',
          height: '90vw',
          maxWidth: 800,
          maxHeight: 800,
          borderRadius: '50%',
          boxShadow: '0 0 120px 40px #00bfff88, 0 0 0 20px #222',
          zIndex: 0,
        }}
      />
      {/* Difuminado suave alrededor del avatar */}
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: '38vw',
          height: '66vh',
          maxWidth: 440,
          maxHeight: 660,
          borderRadius: '50%',
          pointerEvents: 'none',
          zIndex: 1,
          background: 'radial-gradient(circle, rgba(0,191,255,0.18) 0%, rgba(0,0,0,0.10) 60%, rgba(0,0,0,0.0) 100%)',
          filter: 'blur(18px)',
        }}
      />
      <div style={{ width: '32vw', height: '60vh', maxWidth: 400, maxHeight: 600, position: 'relative', zIndex: 2 }}>
        <Canvas camera={{ position: [0, 1.6, 1.2], fov: 28 }} style={{ background: 'transparent', width: '100%', height: '100%' }}>
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 2, 2]} intensity={0.9} />
          <Suspense fallback={null}>
            <AvatarModel talking={talking} />
          </Suspense>
          <OrbitControls target={[0, 1.6, 0]} enablePan={false} enableZoom={false} enableRotate={false} />
        </Canvas>
      </div>
    </div>
  );
};

export default AnimatedAvatar;

// Si el modelo no tiene un nodo "jaw", la animación no se verá. Ajusta el nombre según tu GLB si es necesario.

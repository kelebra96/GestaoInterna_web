'use client';

import { useEffect, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMeasurementStore } from '@/stores/useMeasurementStore';

interface ARSceneProps {
  onSessionStart?: () => void;
}

export function ARScene({ onSessionStart }: ARSceneProps) {
  const { gl, scene, camera } = useThree();
  const [hitTestSource, setHitTestSource] = useState<XRHitTestSource | null>(null);
  const [hitTestSourceRequested, setHitTestSourceRequested] = useState(false);
  const reticleRef = useRef<THREE.Mesh>(null);
  const { points, addPoint } = useMeasurementStore();

  // Cria o retículo (marcador visual de onde o usuário pode tocar)
  useEffect(() => {
    const reticleGeometry = new THREE.RingGeometry(0.05, 0.06, 32);
    const reticleMaterial = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      side: THREE.DoubleSide,
    });

    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    reticle.rotation.x = -Math.PI / 2;

    reticleRef.current = reticle;
    scene.add(reticle);

    return () => {
      scene.remove(reticle);
      reticleGeometry.dispose();
      reticleMaterial.dispose();
    };
  }, [scene]);

  // Configura WebXR session
  useEffect(() => {
    const xrSession = gl.xr.getSession();

    if (xrSession && !hitTestSourceRequested) {
      setHitTestSourceRequested(true);

      // @ts-ignore
      xrSession.requestReferenceSpace('viewer').then((referenceSpace: XRReferenceSpace) => {
        // @ts-ignore
        xrSession.requestHitTestSource({ space: referenceSpace }).then((source: XRHitTestSource) => {
          setHitTestSource(source);
        });
      });

      onSessionStart?.();

      // Adiciona event listener para toques na tela
      const onSelect = (event: any) => {
        if (reticleRef.current?.visible) {
          const position = new THREE.Vector3();
          position.setFromMatrixPosition(reticleRef.current.matrix);
          addPoint(position);
        }
      };

      // @ts-ignore
      xrSession.addEventListener('select', onSelect);

      return () => {
        // @ts-ignore
        xrSession.removeEventListener('select', onSelect);
      };
    }
  }, [gl.xr, hitTestSourceRequested, addPoint, onSessionStart]);

  // Hit testing - atualiza posição do retículo a cada frame
  useFrame((_, delta) => {
    const session = gl.xr.getSession();
    const xrCamera = gl.xr.getCamera(camera);

    if (session && hitTestSource && reticleRef.current) {
      // @ts-ignore
      const frame = gl.xr.getFrame();

      if (frame) {
        // @ts-ignore
        const referenceSpace = gl.xr.getReferenceSpace();

        // @ts-ignore
        const hitTestResults = frame.getHitTestResults(hitTestSource);

        if (hitTestResults.length > 0) {
          const hit = hitTestResults[0];
          // @ts-ignore
          const pose = hit.getPose(referenceSpace);

          if (pose) {
            reticleRef.current.visible = true;
            reticleRef.current.matrix.fromArray(pose.transform.matrix);
          }
        } else {
          reticleRef.current.visible = false;
        }
      }
    }
  });

  return (
    <>
      {/* Luz ambiente */}
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      {/* Renderiza pontos marcados */}
      {points.map((point, index) => (
        <mesh key={point.id} position={point.position}>
          <sphereGeometry args={[0.02, 16, 16]} />
          <meshStandardMaterial color="#16476A" emissive="#3B9797" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* Renderiza linhas conectando os pontos */}
      {points.length >= 2 && <MeasurementLines points={points} />}
    </>
  );
}

// Componente para desenhar linhas entre os pontos
function MeasurementLines({ points }: { points: any[] }) {
  const positions = points.map((p) => p.position);

  if (points.length === 2) {
    // Linha simples entre 2 pontos
    return (
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              positions[0].x, positions[0].y, positions[0].z,
              positions[1].x, positions[1].y, positions[1].z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#00ff00" linewidth={2} />
      </line>
    );
  }

  if (points.length === 4) {
    // Desenha bounding box
    const min = new THREE.Vector3(
      Math.min(...positions.map(p => p.x)),
      Math.min(...positions.map(p => p.y)),
      Math.min(...positions.map(p => p.z))
    );

    const max = new THREE.Vector3(
      Math.max(...positions.map(p => p.x)),
      Math.max(...positions.map(p => p.y)),
      Math.max(...positions.map(p => p.z))
    );

    return (
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(
          max.x - min.x,
          max.y - min.y,
          max.z - min.z
        )]} />
        <lineBasicMaterial color="#00ff00" />
      </lineSegments>
    );
  }

  // Conecta pontos sequencialmente
  return (
    <>
      {points.slice(0, -1).map((point, index) => {
        const nextPoint = points[index + 1];
        return (
          <line key={`line-${index}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  point.position.x, point.position.y, point.position.z,
                  nextPoint.position.x, nextPoint.position.y, nextPoint.position.z,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#00ff00" linewidth={2} />
          </line>
        );
      })}
    </>
  );
}

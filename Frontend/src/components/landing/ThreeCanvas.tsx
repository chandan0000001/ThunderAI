import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface ThreeCanvasProps {
  isDarkMode?: boolean;
}

export const ThreeCanvas: React.FC<ThreeCanvasProps> = ({ isDarkMode = true }) => {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // SCENE, CAMERA, RENDERER
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.1,
      1000
    );
    // Positioned safely back so the entire sphere and rings fit with generous margins
    camera.position.set(0, 0, 5.8);

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = isDarkMode ? 1.3 : 1.05;
    container.appendChild(renderer.domElement);

    // ROOT OBJECT GROUP
    const thunderGroup = new THREE.Group();
    scene.add(thunderGroup);

    // 1. CENTRAL THUNDER PLASMA SPHERE (Smooth High-Poly PBR Mesh - NO FLAT SHADING)
    const coreGeo = new THREE.SphereGeometry(1.1, 64, 64);
    const originalPositions = coreGeo.attributes.position.clone();

    const coreMat = new THREE.MeshPhysicalMaterial({
      color: 0xfacc15, // High voltage electric yellow
      emissive: 0xca8a04, // Deep golden glow
      emissiveIntensity: isDarkMode ? 0.35 : 0.15,
      roughness: 0.12,
      metalness: 0.88,
      clearcoat: 1.0,
      clearcoatRoughness: 0.1,
      flatShading: false, // Smooth normal interpolation
    });

    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    thunderGroup.add(coreMesh);

    // 2. INNER WHITE-HOT CORE
    const innerGeo = new THREE.SphereGeometry(0.7, 32, 32);
    const innerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
    });
    const innerMesh = new THREE.Mesh(innerGeo, innerMat);
    thunderGroup.add(innerMesh);

    // 3. ELECTRIC ATMOSPHERE GLOW SHIELD
    const glowGeo = new THREE.SphereGeometry(1.18, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: isDarkMode ? 0.16 : 0.1,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
    });
    const glowMesh = new THREE.Mesh(glowGeo, glowMat);
    thunderGroup.add(glowMesh);

    // 4. PRECISION GYROSCOPIC ORBITAL RINGS (Ultra-thin, sleek, luxury gold & white)
    const ringMatGold = new THREE.MeshStandardMaterial({
      color: 0xfde047,
      emissive: 0xfacc15,
      emissiveIntensity: isDarkMode ? 0.6 : 0.3,
      roughness: 0.1,
      metalness: 0.95,
      transparent: true,
      opacity: 0.85,
    });

    const ringMatWhite = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: isDarkMode ? 0.8 : 0.4,
      roughness: 0.1,
      metalness: 0.95,
      transparent: true,
      opacity: 0.75,
    });

    // Ring 1 (compact radius: 1.45)
    const ring1Geo = new THREE.TorusGeometry(1.45, 0.009, 16, 120);
    const ring1 = new THREE.Mesh(ring1Geo, ringMatGold);
    ring1.rotation.x = Math.PI / 3;
    thunderGroup.add(ring1);

    // Ring 2 (compact radius: 1.62)
    const ring2Geo = new THREE.TorusGeometry(1.62, 0.008, 16, 120);
    const ring2 = new THREE.Mesh(ring2Geo, ringMatWhite);
    ring2.rotation.y = Math.PI / 4;
    thunderGroup.add(ring2);

    // Ring 3 (compact radius: 1.78)
    const ring3Geo = new THREE.TorusGeometry(1.78, 0.007, 16, 120);
    const ring3 = new THREE.Mesh(ring3Geo, ringMatGold);
    ring3.rotation.z = Math.PI / 5;
    thunderGroup.add(ring3);

    // 5. SMOOTH ORBITING ELECTRIC FILAMENTS (Smooth Bezier arcs hugging the sphere)
    const arcLines: THREE.Line[] = [];
    const arcCount = 4;

    for (let a = 0; a < arcCount; a++) {
      const curvePoints: THREE.Vector3[] = [];
      const segments = 24;
      const baseAngle = (a / arcCount) * Math.PI * 2;
      const tilt = (a % 2 === 0 ? 1 : -1) * (0.3 + a * 0.15);

      for (let s = 0; s <= segments; s++) {
        const theta = baseAngle + (s / segments) * Math.PI * 0.9;
        const radius = 1.22 + Math.sin((s / segments) * Math.PI) * 0.12;
        curvePoints.push(
          new THREE.Vector3(
            Math.cos(theta) * radius,
            Math.sin(theta) * radius * Math.cos(tilt),
            Math.sin(theta) * radius * Math.sin(tilt)
          )
        );
      }

      const arcCurve = new THREE.CatmullRomCurve3(curvePoints);
      const arcGeo = new THREE.BufferGeometry().setFromPoints(arcCurve.getPoints(40));
      const arcMat = new THREE.LineBasicMaterial({
        color: a % 2 === 0 ? 0xffffff : 0xfacc15,
        transparent: true,
        opacity: isDarkMode ? 0.75 : 0.5,
        linewidth: 1,
      });
      const arcLine = new THREE.Line(arcGeo, arcMat);
      thunderGroup.add(arcLine);
      arcLines.push(arcLine);
    }

    // 6. FLOATING THUNDER ENERGY SPARKS (Compact particle cloud within safe radius)
    const particleCount = 450;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleColors = new Float32Array(particleCount * 3);

    const yellowCol = new THREE.Color(0xfacc15);
    const goldCol = new THREE.Color(0xfef08a);
    const whiteCol = new THREE.Color(0xffffff);

    for (let i = 0; i < particleCount; i++) {
      const radius = 1.35 + Math.random() * 0.85; // strictly bounded between 1.35 and 2.2
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      particlePositions[i * 3 + 2] = radius * Math.cos(phi);

      const chosen = i % 3 === 0 ? yellowCol : i % 3 === 1 ? whiteCol : goldCol;
      particleColors[i * 3] = chosen.r;
      particleColors[i * 3 + 1] = chosen.g;
      particleColors[i * 3 + 2] = chosen.b;
    }

    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.024,
      vertexColors: true,
      transparent: true,
      opacity: isDarkMode ? 0.8 : 0.6,
      blending: THREE.AdditiveBlending,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // LIGHTING
    const ambientLight = new THREE.AmbientLight(
      isDarkMode ? 0x202028 : 0xffffff,
      isDarkMode ? 2.0 : 2.4
    );
    scene.add(ambientLight);

    const thunderLight = new THREE.PointLight(0xfacc15, isDarkMode ? 4.5 : 3.0, 12);
    thunderLight.position.set(0, 0, 0);
    scene.add(thunderLight);

    const keyWhite = new THREE.DirectionalLight(0xffffff, isDarkMode ? 3.5 : 2.5);
    keyWhite.position.set(3, 4, 3);
    scene.add(keyWhite);

    const rimAmber = new THREE.DirectionalLight(0xf59e0b, isDarkMode ? 2.5 : 1.8);
    rimAmber.position.set(-3, -2, -2);
    scene.add(rimAmber);

    // MOUSE TRACKING
    let mouseX = 0;
    let mouseY = 0;
    let targetX = 0;
    let targetY = 0;

    const handleMouseMove = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      targetX = x * 0.45;
      targetY = y * 0.35;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // RESIZE LISTENER
    const handleResize = () => {
      if (!container) return;
      const width = container.clientWidth;
      const height = container.clientHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // ANIMATION LOOP
    let animId: number;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      // Mouse lerp
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;

      // Whole core rotation
      thunderGroup.rotation.y = elapsed * 0.2 + mouseX * 0.5;
      thunderGroup.rotation.x = mouseY * 0.35;

      // Rings gyroscopic spin
      ring1.rotation.z = elapsed * 0.35;
      ring2.rotation.x = elapsed * -0.25;
      ring3.rotation.y = elapsed * 0.2;

      // Filaments rotation
      arcLines.forEach((line, idx) => {
        line.rotation.y = elapsed * (0.15 + idx * 0.08);
        line.rotation.z = elapsed * (0.1 + idx * 0.05);
      });

      // Particles rotation
      particles.rotation.y = elapsed * 0.05;
      particles.rotation.x = elapsed * 0.02;

      // Subtle aerodynamic wave pulse (gentle, smooth amplitude: 0.035 - NOT bumpy!)
      const positions = coreGeo.attributes.position;
      const orig = originalPositions;

      for (let i = 0; i < positions.count; i++) {
        const u = orig.getX(i);
        const v = orig.getY(i);
        const w = orig.getZ(i);

        const dist = Math.sqrt(u * u + v * v + w * w);
        const wave =
          Math.sin(dist * 3.0 - elapsed * 2.0) * 0.028 +
          Math.cos(u * 2.0 + elapsed * 1.5) * 0.015;

        const factor = 1 + wave / dist;
        positions.setXYZ(i, u * factor, v * factor, w * factor);
      }
      positions.needsUpdate = true;
      coreGeo.computeVertexNormals();

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animId);

      coreGeo.dispose();
      coreMat.dispose();
      innerGeo.dispose();
      innerMat.dispose();
      glowGeo.dispose();
      glowMat.dispose();
      ring1Geo.dispose();
      ring2Geo.dispose();
      ring3Geo.dispose();
      ringMatGold.dispose();
      ringMatWhite.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      arcLines.forEach((arc) => {
        arc.geometry.dispose();
        (arc.material as THREE.Material).dispose();
      });
      renderer.dispose();

      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDarkMode]);

  return (
    <div className="relative w-full h-full select-none flex items-center justify-center">
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
    </div>
  );
};

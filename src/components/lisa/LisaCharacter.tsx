"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";

import { withBase } from "@/lib/base-path";

export type CharacterClip = "idle" | "talk" | "wave";

const MODEL_PATH = "/assets/lisa/character/lisa.glb?v=poodle-eyes-joined-4";
const STAGE = 0xc9c9c9;

const STILL_EPS = 0.0008;
const STILL_FRAMES_TO_FREEZE = 16;

type LookJoint = {
  bone: THREE.Bone;
  bindQuat: THREE.Quaternion;
  weight: number;
  maxYaw: number;
  maxPitch: number;
  /** 1 = full yaw, 0 = no left/right (neck-only turn). */
  yawScale: number;
};

function findBone(root: THREE.Object3D, names: string[]): THREE.Bone | null {
  for (const name of names) {
    const obj = root.getObjectByName(name);
    if (obj && (obj as THREE.Bone).isBone) return obj as THREE.Bone;
  }
  let found: THREE.Bone | null = null;
  root.traverse((o) => {
    if (found) return;
    if ((o as THREE.Bone).isBone && names.includes(o.name)) {
      found = o as THREE.Bone;
    }
  });
  return found;
}

/**
 * Neck/head mouse tracking with a light upper-chest follow.
 * Mouse right → head looks right; mouse left → looks left.
 */
export function LisaCharacter({
  clip = "idle",
  className = "c-lisa_stage",
}: {
  clip?: CharacterClip;
  className?: string;
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const clipRef = useRef<CharacterClip>(clip);

  useEffect(() => {
    clipRef.current = clip;
  }, [clip]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    RectAreaLightUniformsLib.init();

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setClearColor(STAGE, 1);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(STAGE);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.62;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
    camera.position.set(0, 1.25, 2.6);
    camera.lookAt(0, 1.1, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.28));
    scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b0b0, 0.4));

    const key = new THREE.RectAreaLight(0xffffff, 8, 2.2, 2.2);
    key.position.set(1.0, 2.0, 1.3);
    key.lookAt(0, 1.2, 0);
    scene.add(key);

    const fill = new THREE.RectAreaLight(0xf2f2f2, 3.2, 2.4, 1.8);
    fill.position.set(-1.2, 1.5, 1.0);
    fill.lookAt(0, 1.2, 0);
    scene.add(fill);

    const rim = new THREE.DirectionalLight(0xffffff, 0.4);
    rim.position.set(-0.2, 2.2, -1.6);
    scene.add(rim);

    // Live studio accents — soft movers that keep the bust “alive”
    const warm = new THREE.PointLight(0xffe0c2, 0.7, 6, 2);
    warm.position.set(0.9, 1.55, 1.4);
    scene.add(warm);

    const cool = new THREE.PointLight(0xd8e8ff, 0.55, 6, 2);
    cool.position.set(-1.0, 1.35, 1.15);
    scene.add(cool);

    const cheek = new THREE.SpotLight(0xffffff, 1.0, 7, 0.42, 0.55, 1.4);
    cheek.position.set(0.35, 2.1, 1.8);
    cheek.target.position.set(0, 1.2, 0);
    scene.add(cheek);
    scene.add(cheek.target);

    const keyHome = key.position.clone();
    const fillHome = fill.position.clone();
    const warmHome = warm.position.clone();
    const coolHome = cool.position.clone();
    const cheekHome = cheek.position.clone();
    const lightAim = new THREE.Vector3(0, 1.2, 0);
    const tmpAim = new THREE.Vector3();

    const applyLiveLights = (t: number) => {
      const breath = 0.5 + 0.5 * Math.sin(t * 0.7);
      const breath2 = 0.5 + 0.5 * Math.sin(t * 0.95 + 1.2);
      const mx = mouseNdcSmooth.x;
      const my = mouseNdcSmooth.y;

      key.intensity = 6.4 + breath * 1.1 + Math.abs(mx) * 0.4;
      fill.intensity = 2.5 + breath2 * 0.7;
      rim.intensity = 0.3 + breath * 0.1;
      warm.intensity = 0.55 + breath2 * 0.35 + Math.max(0, mx) * 0.25;
      cool.intensity = 0.45 + breath * 0.3 + Math.max(0, -mx) * 0.25;
      cheek.intensity = 0.85 + breath * 0.35;

      key.position.set(
        keyHome.x + Math.sin(t * 0.35) * 0.18 + mx * 0.22,
        keyHome.y + Math.sin(t * 0.55 + 0.4) * 0.08 + my * 0.1,
        keyHome.z + Math.cos(t * 0.35) * 0.1
      );
      fill.position.set(
        fillHome.x + Math.sin(t * 0.28 + 1.5) * 0.14 + mx * 0.12,
        fillHome.y + Math.cos(t * 0.4) * 0.07 + my * 0.06,
        fillHome.z + Math.sin(t * 0.33) * 0.08
      );
      warm.position.set(
        warmHome.x + Math.sin(t * 0.6) * 0.25 + mx * 0.3,
        warmHome.y + Math.sin(t * 0.8 + 0.7) * 0.12,
        warmHome.z + Math.cos(t * 0.55) * 0.18
      );
      cool.position.set(
        coolHome.x + Math.cos(t * 0.5) * 0.22 + mx * 0.2,
        coolHome.y + Math.sin(t * 0.65 + 1.1) * 0.1,
        coolHome.z + Math.sin(t * 0.48) * 0.16
      );
      cheek.position.set(
        cheekHome.x + mx * 0.45 + Math.sin(t * 0.45) * 0.12,
        cheekHome.y + my * 0.15,
        cheekHome.z
      );

      tmpAim.copy(lightAim);
      tmpAim.x += mx * 0.25;
      tmpAim.y += my * 0.12;
      key.lookAt(tmpAim);
      fill.lookAt(tmpAim);
      cheek.target.position.copy(tmpAim);
      cheek.target.updateMatrixWorld();

      // Tiny exposure drift so the stage never feels frozen
      renderer.toneMappingExposure = 0.98 + breath * 0.04 + Math.abs(mx) * 0.015;
      scene.environmentIntensity = 0.52 + breath2 * 0.08;
    };

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(5);
    scene.add(root);

    const clock = new THREE.Clock();
    let raf = 0;
    let disposed = false;

    const mouseNdc = new THREE.Vector2(0, 0);
    const mouseNdcSmooth = new THREE.Vector2(0, 0);
    const prevMouse = new THREE.Vector2(0, 0);
    let mouseMoved = false;
    let gazeSettled = true;
    let stillFrames = 0;

    const headWorld = new THREE.Vector3();
    const box = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    let joints: LookJoint[] = [];
    let skeleton: THREE.Skeleton | null = null;
    let framed = false;
    let mixer: THREE.AnimationMixer | null = null;

    let targetYaw = 0;
    let targetPitch = 0;
    let smoothYaw = 0;
    let smoothPitch = 0;

    let framePortraitFn: (() => void) | null = null;

    const resize = () => {
      const w = mount.clientWidth || window.innerWidth;
      const h = mount.clientHeight || window.innerHeight;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(w, h, false);
      camera.aspect = w / Math.max(h, 1);
      camera.updateProjectionMatrix();
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";
      renderer.domElement.style.display = "block";
      framePortraitFn?.();
    };
    resize();

    const onMove = (e: PointerEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      // Full viewport NDC — edge of screen = max look
      mouseNdc.x = (e.clientX / w) * 2 - 1;
      mouseNdc.y = -((e.clientY / h) * 2 - 1);
      mouseMoved = true;
      gazeSettled = false;
      stillFrames = 0;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(() => resize());
    ro.observe(mount);

    const applyGaze = (dt: number) => {
      if (!joints.length) return;

      if (mouseMoved) {
        // Full viewport, but dialed back a bit from max turn
        targetYaw = mouseNdcSmooth.x * 0.72;
        targetPitch = mouseNdcSmooth.y * 0.32;
      }

      const damp = mouseMoved ? 11 : 13;
      const k = 1 - Math.exp(-dt * damp);
      smoothYaw += (targetYaw - smoothYaw) * k;
      smoothPitch += (targetPitch - smoothPitch) * k;

      const qYaw = new THREE.Quaternion();
      const qPitch = new THREE.Quaternion();
      const qOffset = new THREE.Quaternion();

      for (const joint of joints) {
        const { bone, bindQuat, weight, maxYaw, maxPitch, yawScale } = joint;
        const yaw = THREE.MathUtils.clamp(
          smoothYaw * weight * yawScale,
          -maxYaw,
          maxYaw
        );
        const pitch = THREE.MathUtils.clamp(
          smoothPitch * weight,
          -maxPitch,
          maxPitch
        );

        // Twist around the neck bone (Y) + nod (X). Pivot is the bone head
        // at the back of the collar — whole head orbits the neck, not the mouth.
        qYaw.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
        qPitch.setFromAxisAngle(new THREE.Vector3(1, 0, 0), -pitch);
        qOffset.copy(qYaw).multiply(qPitch);
        bone.quaternion.copy(bindQuat).multiply(qOffset);
        // Keep skin matrices in sync with the new local rotation
        bone.updateMatrix();
        bone.updateMatrixWorld(true);
      }

      if (skeleton) {
        const rootBone = skeleton.bones[0];
        if (rootBone?.parent) rootBone.parent.updateMatrixWorld(true);
        else skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
        skeleton.update();
      }

      const angErr =
        Math.abs(smoothYaw - targetYaw) + Math.abs(smoothPitch - targetPitch);
      if (!mouseMoved && angErr < 0.002) gazeSettled = true;
    };

    new GLTFLoader().load(
      withBase(MODEL_PATH),
      (gltf) => {
        if (disposed) return;
        const model = gltf.scene;

        model.traverse((obj) => {
          const mesh = obj as THREE.SkinnedMesh;
          if (!(mesh as THREE.Mesh).isMesh) return;
          mesh.frustumCulled = false;
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          if (mesh.isSkinnedMesh && mesh.skeleton) skeleton = mesh.skeleton;
          const mats = Array.isArray(mesh.material)
            ? mesh.material
            : [mesh.material];
          for (const mat of mats) {
            const std = mat as THREE.MeshStandardMaterial;
            if (std.map) std.map.colorSpace = THREE.SRGBColorSpace;
            if ("envMapIntensity" in std) std.envMapIntensity = 0.55;
            if ("metalness" in std && std.metalness > 0.35) std.metalness = 0.05;
            if ("roughness" in std && std.roughness > 0.9) std.roughness = 0.72;
            // Hide open mouth/nose cavity interiors (DoubleSide looked like a face tear).
            std.side = THREE.FrontSide;
            std.needsUpdate = true;
          }
        });

        root.add(model);
        root.updateMatrixWorld(true);

        const chest = findBone(model, ["chest"]);
        const n1 = findBone(model, ["neck_01"]);

        // Play Blender-authored nose sniff clip (dog-like twitches every few seconds)
        if (gltf.animations?.length) {
          mixer = new THREE.AnimationMixer(model);
          const sniff =
            gltf.animations.find((c) => /nose|sniff/i.test(c.name)) ??
            gltf.animations[0];
          const action = mixer.clipAction(sniff);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
        }

        const make = (
          bone: THREE.Bone | null,
          weight: number,
          maxYaw: number,
          maxPitch: number,
          yawScale = 1
        ): LookJoint | null => {
          if (!bone) return null;
          bone.updateWorldMatrix(true, false);
          return {
            bone,
            bindQuat: bone.quaternion.clone(),
            weight,
            maxYaw,
            maxPitch,
            yawScale,
          };
        };

        // Chest leads a little; neck does most of the look (parent → child).
        joints = [
          make(chest, 0.3, 0.2, 0.07, 1),
          make(n1, 0.95, 0.55, 0.24, 1),
        ].filter(Boolean) as LookJoint[];


        const framePortrait = () => {
          root.updateMatrixWorld(true);
          box.setFromObject(model);
          box.getSize(size);
          box.getCenter(center);

          const lookY = box.min.y + size.y * 0.59;
          headWorld.set(center.x, lookY, center.z);
          const dist = Math.max(2.25, size.y * 1.45);
          const mobile = (mount.clientWidth || window.innerWidth) < 1024;
          // Desktop: shift dog right for left-column UI. Mobile: center in stage.
          const screenShiftX = mobile ? 0 : 0.48;
          camera.fov = mobile ? 38 : 34;
          camera.updateProjectionMatrix();
          camera.position.set(
            headWorld.x,
            headWorld.y + (mobile ? 0.04 : 0.025),
            headWorld.z + dist * (mobile ? 1.05 : 1)
          );
          camera.lookAt(
            headWorld.x - screenShiftX,
            headWorld.y - (mobile ? 0.04 : 0.025),
            headWorld.z
          );
          lightAim.set(headWorld.x, headWorld.y, headWorld.z);
          key.lookAt(lightAim);
          fill.lookAt(lightAim);
          cheek.target.position.copy(lightAim);
          framed = true;
        };
        framePortraitFn = framePortrait;

        requestAnimationFrame(() => {
          framePortrait();
          requestAnimationFrame(framePortrait);
        });
      },
      undefined,
      (err) => console.error("Failed to load character", err)
    );

    const tick = () => {
      const dt = Math.min(clock.getDelta(), 0.05);
      const movedDist = mouseNdc.distanceTo(prevMouse);
      if (movedDist > STILL_EPS) mouseMoved = true;
      prevMouse.copy(mouseNdc);

      mouseNdcSmooth.lerp(mouseNdc, 1 - Math.exp(-dt * 14));
      const followErr = mouseNdcSmooth.distanceTo(mouseNdc);
      if (followErr < STILL_EPS && movedDist < STILL_EPS) {
        mouseMoved = false;
        stillFrames += 1;
      } else {
        stillFrames = 0;
      }

      if (framed && mixer) {
        mixer.update(dt);
        if (skeleton) {
          const rootBone = skeleton.bones[0];
          if (rootBone?.parent) rootBone.parent.updateMatrixWorld(true);
          else skeleton.bones.forEach((b) => b.updateMatrixWorld(true));
          skeleton.update();
        }
      }

      if (framed && (!gazeSettled || mouseMoved)) applyGaze(dt);
      if (!mouseMoved && stillFrames >= STILL_FRAMES_TO_FREEZE) {
        gazeSettled = true;
      }

      applyLiveLights(clock.elapsedTime);

      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      ro.disconnect();
      if (renderer.domElement.parentElement === mount) {
        mount.removeChild(renderer.domElement);
      }
      renderer.dispose();
      pmrem.dispose();
    };
  }, []);

  return <div ref={mountRef} className={className} aria-hidden="true" />;
}

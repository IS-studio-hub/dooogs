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
 * Neck/head look tracking:
 * - Desktop: follows the mouse
 * - Mobile / tablet: follows the user via device orientation sensors
 *   (tilt / move the device — character looks toward you)
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
    renderer.toneMappingExposure = 1.12;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(STAGE);
    // Soft depth haze — reads more “set” than flat studio gray
    scene.fog = new THREE.Fog(STAGE, 4.2, 11);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const env = pmrem.fromScene(new RoomEnvironment(), 0.02).texture;
    scene.environment = env;
    scene.environmentIntensity = 0.38;

    const camera = new THREE.PerspectiveCamera(36, 1, 0.05, 40);
    camera.position.set(0, 1.25, 2.6);
    camera.lookAt(0, 1.1, 0);

    // ——— Soft studio lighting (quiet key / fill / rim) ———
    // Higher ambient, lower contrast — form without drama.
    scene.add(new THREE.AmbientLight(0xc8c4c0, 0.38));
    scene.add(new THREE.HemisphereLight(0xf5f0ea, 0x8a8a90, 0.42));

    // Softbox key (area) — gentle beauty wrap
    const key = new THREE.RectAreaLight(0xfff2e4, 4.2, 2.8, 2.2);
    key.position.set(1.15, 2.15, 1.55);
    key.lookAt(0, 1.15, 0);
    scene.add(key);

    // Soft shadow key — light contact without hard edges
    const keySun = new THREE.DirectionalLight(0xffe8d2, 0.55);
    keySun.position.set(1.6, 2.8, 1.9);
    keySun.castShadow = true;
    keySun.shadow.mapSize.set(2048, 2048);
    keySun.shadow.camera.near = 0.5;
    keySun.shadow.camera.far = 12;
    keySun.shadow.camera.left = -2.5;
    keySun.shadow.camera.right = 2.5;
    keySun.shadow.camera.top = 2.5;
    keySun.shadow.camera.bottom = -2.5;
    keySun.shadow.bias = -0.00025;
    keySun.shadow.normalBias = 0.04;
    keySun.shadow.radius = 6;
    scene.add(keySun);
    keySun.target.position.set(0, 1.2, 0);
    scene.add(keySun.target);

    // Cool fill — almost even with key
    const fill = new THREE.RectAreaLight(0xdde6f5, 2.0, 2.8, 2.2);
    fill.position.set(-1.55, 1.35, 1.25);
    fill.lookAt(0, 1.1, 0);
    scene.add(fill);

    // Soft rim — faint silhouette lift
    const rim = new THREE.SpotLight(0xb8d4ff, 1.8, 14, 0.65, 0.65, 1.1);
    rim.position.set(-0.85, 2.55, -2.1);
    rim.target.position.set(0, 1.25, 0);
    rim.castShadow = false;
    scene.add(rim);
    scene.add(rim.target);

    // Warm kicker — barely-there edge catch
    const kick = new THREE.SpotLight(0xffc9a0, 1.1, 10, 0.55, 0.7, 1.25);
    kick.position.set(1.9, 1.7, -0.35);
    kick.target.position.set(0, 1.2, 0);
    scene.add(kick);
    scene.add(kick.target);

    // Soft bounce from below
    const bounce = new THREE.RectAreaLight(0xffffff, 0.55, 3.2, 1.2);
    bounce.position.set(0.1, 0.15, 1.1);
    bounce.lookAt(0, 1.2, 0);
    scene.add(bounce);

    // Tiny eye catch
    const eyeCatch = new THREE.PointLight(0xfff6ea, 0.22, 3.5, 2);
    eyeCatch.position.set(0.25, 1.55, 1.85);
    scene.add(eyeCatch);

    // Quiet warm / cool accents
    const warm = new THREE.PointLight(0xffd7b0, 0.28, 5.5, 2);
    warm.position.set(0.95, 1.6, 1.35);
    scene.add(warm);

    const cool = new THREE.PointLight(0xc5d9ff, 0.22, 5.5, 2);
    cool.position.set(-1.05, 1.4, 1.1);
    scene.add(cool);

    const cheek = new THREE.SpotLight(0xfff0e0, 0.45, 7, 0.42, 0.75, 1.35);
    cheek.position.set(0.45, 2.15, 1.85);
    cheek.target.position.set(0, 1.2, 0);
    scene.add(cheek);
    scene.add(cheek.target);

    // Soft contact shadow
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 10),
      new THREE.ShadowMaterial({ opacity: 0.12, color: 0x000000 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.05;
    ground.receiveShadow = true;
    scene.add(ground);

    const keyHome = key.position.clone();
    const fillHome = fill.position.clone();
    const warmHome = warm.position.clone();
    const coolHome = cool.position.clone();
    const cheekHome = cheek.position.clone();
    const rimHome = rim.position.clone();
    const kickHome = kick.position.clone();
    const keySunHome = keySun.position.clone();
    const lightAim = new THREE.Vector3(0, 1.2, 0);
    const tmpAim = new THREE.Vector3();

    const applyLiveLights = (t: number) => {
      const breath = 0.5 + 0.5 * Math.sin(t * 0.55);
      const breath2 = 0.5 + 0.5 * Math.sin(t * 0.82 + 1.1);
      const breath3 = 0.5 + 0.5 * Math.sin(t * 0.4 + 2.4);
      const mx = lookNdcSmooth.x;
      const my = lookNdcSmooth.y;

      key.intensity = 3.8 + breath * 0.45 + Math.abs(mx) * 0.2;
      keySun.intensity = 0.48 + breath * 0.08 + Math.max(0, mx) * 0.06;
      fill.intensity = 1.7 + breath2 * 0.2;
      rim.intensity = 1.5 + breath3 * 0.35 + Math.max(0, -mx) * 0.2;
      kick.intensity = 0.9 + breath * 0.25 + Math.max(0, mx) * 0.15;
      bounce.intensity = 0.45 + breath2 * 0.1;
      eyeCatch.intensity = 0.18 + breath * 0.08;
      warm.intensity = 0.22 + breath2 * 0.12 + Math.max(0, mx) * 0.08;
      cool.intensity = 0.18 + breath * 0.1 + Math.max(0, -mx) * 0.08;
      cheek.intensity = 0.38 + breath * 0.12;

      key.position.set(
        keyHome.x + Math.sin(t * 0.28) * 0.14 + mx * 0.2,
        keyHome.y + Math.sin(t * 0.45 + 0.4) * 0.07 + my * 0.08,
        keyHome.z + Math.cos(t * 0.28) * 0.08
      );
      keySun.position.set(
        keySunHome.x + mx * 0.25,
        keySunHome.y + my * 0.1,
        keySunHome.z
      );
      fill.position.set(
        fillHome.x + Math.sin(t * 0.24 + 1.5) * 0.12 + mx * 0.1,
        fillHome.y + Math.cos(t * 0.35) * 0.06 + my * 0.05,
        fillHome.z + Math.sin(t * 0.3) * 0.07
      );
      rim.position.set(
        rimHome.x + Math.sin(t * 0.22) * 0.12 - mx * 0.15,
        rimHome.y + Math.cos(t * 0.3) * 0.08,
        rimHome.z
      );
      kick.position.set(
        kickHome.x + Math.cos(t * 0.26) * 0.1 + mx * 0.18,
        kickHome.y + Math.sin(t * 0.33) * 0.08,
        kickHome.z
      );
      warm.position.set(
        warmHome.x + Math.sin(t * 0.5) * 0.2 + mx * 0.28,
        warmHome.y + Math.sin(t * 0.7 + 0.7) * 0.1,
        warmHome.z + Math.cos(t * 0.48) * 0.14
      );
      cool.position.set(
        coolHome.x + Math.cos(t * 0.42) * 0.18 + mx * 0.18,
        coolHome.y + Math.sin(t * 0.55 + 1.1) * 0.09,
        coolHome.z + Math.sin(t * 0.4) * 0.12
      );
      cheek.position.set(
        cheekHome.x + mx * 0.4 + Math.sin(t * 0.4) * 0.1,
        cheekHome.y + my * 0.12,
        cheekHome.z
      );
      eyeCatch.position.set(0.2 + mx * 0.15, 1.52 + my * 0.05, 1.85);

      tmpAim.copy(lightAim);
      tmpAim.x += mx * 0.28;
      tmpAim.y += my * 0.12;
      key.lookAt(tmpAim);
      fill.lookAt(tmpAim);
      cheek.target.position.copy(tmpAim);
      cheek.target.updateMatrixWorld();
      rim.target.position.copy(tmpAim);
      rim.target.updateMatrixWorld();
      kick.target.position.copy(tmpAim);
      kick.target.updateMatrixWorld();
      keySun.target.position.copy(tmpAim);
      keySun.target.updateMatrixWorld();

      // Gentle exposure pulse — filmic, not disco
      renderer.toneMappingExposure =
        1.05 + breath * 0.05 + Math.abs(mx) * 0.02;
      scene.environmentIntensity = 0.32 + breath2 * 0.08;
    };

    const root = new THREE.Group();
    root.rotation.x = THREE.MathUtils.degToRad(5);
    scene.add(root);

    const clock = new THREE.Clock();
    let raf = 0;
    let disposed = false;

    /** -1..1 look target (mouse NDC on desktop, sensor-derived on mobile) */
    const lookNdc = new THREE.Vector2(0, 0);
    const lookNdcSmooth = new THREE.Vector2(0, 0);
    const prevLook = new THREE.Vector2(0, 0);
    let lookMoved = false;
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

    // Phones + tablets only: device orientation. Desktop keeps mouse.
    const useDeviceSensors =
      typeof window !== "undefined" &&
      (window.matchMedia("(hover: none) and (pointer: coarse)").matches ||
        (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent) &&
          (navigator.maxTouchPoints || 0) > 0 &&
          window.matchMedia("(hover: none)").matches));

    // Baseline orientation so first reading = looking forward (not a jump)
    let orientBase: { beta: number; gamma: number } | null = null;

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

    const pushLook = (x: number, y: number) => {
      lookNdc.x = THREE.MathUtils.clamp(x, -1, 1);
      lookNdc.y = THREE.MathUtils.clamp(y, -1, 1);
      lookMoved = true;
      gazeSettled = false;
      stillFrames = 0;
    };

    const onMove = (e: PointerEvent) => {
      if (useDeviceSensors) return; // mobile/tablet: sensors only
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      pushLook((e.clientX / w) * 2 - 1, -((e.clientY / h) * 2 - 1));
    };

    const onDeviceOrient = (e: DeviceOrientationEvent) => {
      if (!useDeviceSensors || disposed) return;
      // beta: front-back (-180..180), gamma: left-right (-90..90)
      const beta = e.beta;
      const gamma = e.gamma;
      if (beta == null || gamma == null) return;

      if (!orientBase) {
        orientBase = { beta, gamma };
      }

      // Delta from the pose when sensors started = where the user's face moved
      const dGamma = gamma - orientBase.gamma;
      const dBeta = beta - orientBase.beta;

      // Map degrees → look NDC. Flip gamma so tilting phone right looks right.
      // Holding phone upright: moving face/device left-right drives yaw.
      const x = THREE.MathUtils.clamp(dGamma / 28, -1, 1);
      const y = THREE.MathUtils.clamp(-dBeta / 36, -1, 1);
      pushLook(x, y);
    };

    const requestOrientPermission = async () => {
      if (!useDeviceSensors) return;
      const DOE = DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<"granted" | "denied">;
      };
      try {
        if (typeof DOE.requestPermission === "function") {
          const res = await DOE.requestPermission();
          if (res !== "granted") return;
        }
      } catch {
        /* continue — many Androids don't need this */
      }
      // Re-bind after iOS grant (safe if already listening)
      window.removeEventListener("deviceorientation", onDeviceOrient, true);
      window.addEventListener("deviceorientation", onDeviceOrient, true);
      orientBase = null; // recalibrate facing the user after permission
    };

    // iOS requires a user gesture — hook the first tap/touch anywhere
    const onFirstGesture = () => {
      void requestOrientPermission();
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
    };

    if (useDeviceSensors) {
      // Android usually works immediately; iOS unlocks on first tap
      window.addEventListener("deviceorientation", onDeviceOrient, true);
      window.addEventListener("pointerdown", onFirstGesture, { once: true });
      window.addEventListener("touchstart", onFirstGesture, { once: true });
    } else {
      window.addEventListener("pointermove", onMove);
    }

    window.addEventListener("resize", resize);
    const ro = new ResizeObserver(() => resize());
    ro.observe(mount);

    const applyGaze = (dt: number) => {
      if (!joints.length) return;

      if (lookMoved) {
        // Full viewport, but dialed back a bit from max turn
        targetYaw = lookNdcSmooth.x * 0.72;
        targetPitch = lookNdcSmooth.y * 0.32;
      }

      const damp = lookMoved ? 11 : 13;
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
      if (!lookMoved && angErr < 0.002) gazeSettled = true;
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
            if ("envMapIntensity" in std) std.envMapIntensity = 0.42;
            if ("metalness" in std && std.metalness > 0.35) std.metalness = 0.05;
            if ("roughness" in std && std.roughness > 0.9) std.roughness = 0.68;
            // Hide open mouth/nose cavity interiors (DoubleSide looked like a face tear).
            std.side = THREE.FrontSide;
            std.needsUpdate = true;
          }
        });

        root.add(model);
        root.updateMatrixWorld(true);

        // Sit the shadow floor under the paws
        box.setFromObject(model);
        ground.position.y = box.min.y + 0.01;

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
      const movedDist = lookNdc.distanceTo(prevLook);
      if (movedDist > STILL_EPS) lookMoved = true;
      prevLook.copy(lookNdc);

      // Sensors: slightly softer follow so gyro noise doesn't jitter the neck
      const followRate = useDeviceSensors ? 9 : 14;
      lookNdcSmooth.lerp(lookNdc, 1 - Math.exp(-dt * followRate));
      const followErr = lookNdcSmooth.distanceTo(lookNdc);
      if (followErr < STILL_EPS && movedDist < STILL_EPS) {
        lookMoved = false;
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

      if (framed && (!gazeSettled || lookMoved)) applyGaze(dt);
      if (!lookMoved && stillFrames >= STILL_FRAMES_TO_FREEZE) {
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
      window.removeEventListener("deviceorientation", onDeviceOrient, true);
      window.removeEventListener("pointerdown", onFirstGesture);
      window.removeEventListener("touchstart", onFirstGesture);
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

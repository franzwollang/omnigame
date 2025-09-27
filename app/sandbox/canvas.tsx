"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export default function SandboxCanvas() {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const frameRef = useRef<number>();

	useEffect(() => {
		const canvasEl = canvasRef.current;
		const containerEl = containerRef.current;
		if (!canvasEl || !containerEl) return;

		const renderer = new THREE.WebGLRenderer({
			canvas: canvasEl,
			antialias: true
		});
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

		const scene = new THREE.Scene();
		scene.background = new THREE.Color("#f1f5f9");

		const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
		camera.position.set(0, 0, 5);
		camera.lookAt(0, 0, 0);

		// Board plane
		const planeWidth = 4;
		const planeHeight = 4;
		const planeGeometry = new THREE.PlaneGeometry(planeWidth, planeHeight);
		const planeMaterial = new THREE.MeshBasicMaterial({
			color: 0xffffff,
			side: THREE.DoubleSide
		});
		const plane = new THREE.Mesh(planeGeometry, planeMaterial);
		scene.add(plane);
		// Board edge
		const edges = new THREE.EdgesGeometry(planeGeometry);
		const edgeLines = new THREE.LineSegments(
			edges,
			new THREE.LineBasicMaterial({ color: 0x94a3b8 })
		);
		edgeLines.position.z = 0.0002;
		scene.add(edgeLines);

		// Finer grid overlay
		const gridHelper = new THREE.GridHelper(planeWidth, 32, 0x94a3b8, 0xcbd5e1);
		gridHelper.rotation.x = Math.PI / 2;
		gridHelper.position.z = 0.0001;
		scene.add(gridHelper);

		// Lighting
		const light = new THREE.DirectionalLight(0xffffff, 1.0);
		light.position.set(2, 4, 5);
		scene.add(light);
		const ambient = new THREE.AmbientLight(0xffffff, 0.5);
		scene.add(ambient);

		// Controls with pan/zoom clamped to plane bounds
		const controls = new OrbitControls(camera, renderer.domElement);
		controls.enableRotate = false;
		controls.enableDamping = false;
		controls.screenSpacePanning = true;
		controls.enablePan = true;
		controls.mouseButtons = {
			LEFT: THREE.MOUSE.PAN,
			MIDDLE: THREE.MOUSE.DOLLY,
			RIGHT: THREE.MOUSE.PAN
		};
		controls.touches = {
			ONE: THREE.TOUCH.PAN,
			TWO: THREE.TOUCH.DOLLY_PAN
		};

		const boardMarginFactor = 1.15;

		const updateZoomBounds = () => {
			const fovRad = (camera.fov * Math.PI) / 180;
			const distToFitHeight = planeHeight / (2 * Math.tan(fovRad / 2));
			const distToFitWidth =
				planeWidth / (2 * Math.tan(fovRad / 2) * camera.aspect);
			controls.minDistance = 0.3;
			controls.maxDistance = Math.max(
				0.5,
				Math.max(distToFitHeight, distToFitWidth) * boardMarginFactor
			);
		};

		const clampPanAndZoom = () => {
			const fovRad = (camera.fov * Math.PI) / 180;
			const distance = camera.position.distanceTo(
				controls.target as THREE.Vector3
			);
			const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
			const visibleWidth = visibleHeight * camera.aspect;
			const margin = 0.05 * Math.max(planeWidth, planeHeight);

			const minX = -planeWidth / 2 + visibleWidth / 2 - margin;
			const maxX = planeWidth / 2 - visibleWidth / 2 + margin;
			const minY = -planeHeight / 2 + visibleHeight / 2 - margin;
			const maxY = planeHeight / 2 - visibleHeight / 2 + margin;

			const clampedTarget = (controls.target as THREE.Vector3).clone();
			clampedTarget.x = THREE.MathUtils.clamp(clampedTarget.x, minX, maxX);
			clampedTarget.y = THREE.MathUtils.clamp(clampedTarget.y, minY, maxY);

			const direction = new THREE.Vector3()
				.subVectors(camera.position, controls.target as THREE.Vector3)
				.normalize()
				.multiplyScalar(distance);

			(controls.target as THREE.Vector3).copy(clampedTarget);
			camera.position.copy(clampedTarget).add(direction);
			controls.update();
		};

		const resizeToContainer = () => {
			const width = containerEl.clientWidth;
			const height = containerEl.clientHeight;
			if (width === 0 || height === 0) return;
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			updateZoomBounds();
			clampPanAndZoom();
		};

		resizeToContainer();
		const ro = new ResizeObserver(resizeToContainer);
		ro.observe(containerEl);

		const tick = () => {
			renderer.render(scene, camera);
			clampPanAndZoom();
			frameRef.current = requestAnimationFrame(tick);
		};

		tick();

		const jumpPanTo = (x: number, y: number) => {
			const fovRad = (camera.fov * Math.PI) / 180;
			const distance = camera.position.distanceTo(
				controls.target as THREE.Vector3
			);
			const visibleHeight = 2 * distance * Math.tan(fovRad / 2);
			const visibleWidth = visibleHeight * camera.aspect;
			const margin = 0.05 * Math.max(planeWidth, planeHeight);
			const minX = -planeWidth / 2 + visibleWidth / 2 - margin;
			const maxX = planeWidth / 2 - visibleWidth / 2 + margin;
			const minY = -planeHeight / 2 + visibleHeight / 2 - margin;
			const maxY = planeHeight / 2 - visibleHeight / 2 + margin;
			const targetX = THREE.MathUtils.clamp(x, minX, maxX);
			const targetY = THREE.MathUtils.clamp(y, minY, maxY);
			const newTarget = new THREE.Vector3(targetX, targetY, 0);
			const direction = new THREE.Vector3()
				.subVectors(camera.position, controls.target as THREE.Vector3)
				.normalize()
				.multiplyScalar(distance);
			(controls.target as THREE.Vector3).copy(newTarget);
			camera.position.copy(newTarget).add(direction);
			controls.update();
		};
		// @ts-ignore
		(window as any).jumpPanTo = jumpPanTo;

		return () => {
			ro.disconnect();
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
			renderer.dispose();
			planeGeometry.dispose();
			planeMaterial.dispose();
			edges.dispose();
			(edgeLines.material as THREE.Material).dispose();
			controls.dispose();
		};
	}, []);

	return (
		<div ref={containerRef} className="relative flex h-full min-w-0 flex-1">
			<canvas ref={canvasRef} className="block h-full w-full" />
		</div>
	);
}

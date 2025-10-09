"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import type { GameState, Position } from "@/engine/types";
import { getCell } from "@/engine/types";

type Props = {
	gameState: GameState;
	onCellClick: (pos: Position) => void;
	onActivateColumn?: (col: number) => void;
	inputMode?: "cell" | "column";
	// token rendering
	tokens?: {
		id: string;
		label?: string;
		players: ("X" | "O")[];
		asset?: { type: "image"; url: string };
	}[];
	placements?: { row: number; col: number; tokenId: string }[];
};

export default function SandboxCanvas({
	gameState,
	onCellClick,
	onActivateColumn,
	inputMode = "cell",
	tokens = [],
	placements = []
}: Props) {
	const containerRef = useRef<HTMLDivElement | null>(null);
	const canvasRef = useRef<HTMLCanvasElement | null>(null);
	const frameRef = useRef<number>();
	const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
	const cellMeshesRef = useRef<THREE.Mesh[]>([]);
	const marksGroupRef = useRef<THREE.Group | null>(null);
	const onCellClickRef = useRef(onCellClick);
	const onActivateColumnRef = useRef<typeof onActivateColumn>(onActivateColumn);
	const inputModeRef = useRef(inputMode);

	// Keep click handler ref up to date
	useEffect(() => {
		onCellClickRef.current = onCellClick;
	}, [onCellClick]);

	useEffect(() => {
		onActivateColumnRef.current = onActivateColumn;
		inputModeRef.current = inputMode;
	}, [onActivateColumn, inputMode]);

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

		// Board dimensions from game state
		const { width: gridWidth, height: gridHeight } = gameState.grid;
		const cellSize = 0.9;
		const spacing = 0.1;
		const totalCellSize = cellSize + spacing;
		const planeWidth = gridWidth * totalCellSize;
		const planeHeight = gridHeight * totalCellSize;

		// Board plane
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

		// Grid lines for rectangular grids (manual)
		{
			const lineMaterial = new THREE.LineBasicMaterial({ color: 0xcbd5e1 });
			const positions: number[] = [];
			// Vertical lines
			for (let c = 0; c <= gridWidth; c++) {
				const x = -planeWidth / 2 + c * totalCellSize;
				positions.push(x, -planeHeight / 2, 0.0001, x, planeHeight / 2, 0.0001);
			}
			// Horizontal lines
			for (let r = 0; r <= gridHeight; r++) {
				const y = -planeHeight / 2 + r * totalCellSize;
				positions.push(-planeWidth / 2, y, 0.0001, planeWidth / 2, y, 0.0001);
			}
			const geometry = new THREE.BufferGeometry();
			geometry.setAttribute(
				"position",
				new THREE.Float32BufferAttribute(positions, 3)
			);
			const gridLines = new THREE.LineSegments(geometry, lineMaterial);
			scene.add(gridLines);
		}

		// Render cells as clickable meshes
		const cellMeshes: THREE.Mesh[] = [];
		for (let row = 0; row < gridHeight; row++) {
			for (let col = 0; col < gridWidth; col++) {
				const cellGeo = new THREE.PlaneGeometry(cellSize, cellSize);
				const cellMat = new THREE.MeshBasicMaterial({
					color: 0xf8fafc,
					transparent: true,
					opacity: 0.01,
					side: THREE.DoubleSide
				});
				const cellMesh = new THREE.Mesh(cellGeo, cellMat);
				const x = (col - (gridWidth - 1) / 2) * totalCellSize;
				const y = -(row - (gridHeight - 1) / 2) * totalCellSize;
				cellMesh.position.set(x, y, 0.0003);
				cellMesh.userData = { row, col };
				scene.add(cellMesh);
				cellMeshes.push(cellMesh);
			}
		}
		cellMeshesRef.current = cellMeshes;

		// Marks/tokens group
		const marksGroup = new THREE.Group();
		scene.add(marksGroup);
		marksGroupRef.current = marksGroup;

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
			const fitDist =
				Math.max(distToFitHeight, distToFitWidth) * boardMarginFactor;
			controls.minDistance = 0.3;
			controls.maxDistance = Math.max(0.5, fitDist);
		};

		const setCameraToFitBoard = () => {
			// Center on board and set distance to show full board
			(controls.target as THREE.Vector3).set(0, 0, 0);
			const fovRad = (camera.fov * Math.PI) / 180;
			const distToFitHeight = planeHeight / (2 * Math.tan(fovRad / 2));
			const distToFitWidth =
				planeWidth / (2 * Math.tan(fovRad / 2) * camera.aspect);
			const fitDist =
				Math.max(distToFitHeight, distToFitWidth) * boardMarginFactor;
			camera.position.set(0, 0, fitDist);
			camera.updateProjectionMatrix();
			controls.update();
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

		// Click handler for cell selection (use ref to avoid effect deps)
		const handleCanvasClick = (e: MouseEvent) => {
			const rect = canvasEl.getBoundingClientRect();
			const mouse = new THREE.Vector2(
				((e.clientX - rect.left) / rect.width) * 2 - 1,
				-((e.clientY - rect.top) / rect.height) * 2 + 1
			);
			raycasterRef.current.setFromCamera(mouse, camera);
			const intersects = raycasterRef.current.intersectObjects(cellMeshes);
			if (intersects.length > 0) {
				const { row, col } = intersects[0].object.userData;
				if (inputModeRef.current === "column" && onActivateColumnRef.current) {
					onActivateColumnRef.current(col);
				} else {
					onCellClickRef.current({ row, col });
				}
			}
		};
		canvasEl.addEventListener("click", handleCanvasClick);

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
		setCameraToFitBoard();
		const ro = new ResizeObserver(resizeToContainer);
		ro.observe(containerEl);

		const tick = () => {
			renderer.render(scene, camera);
			clampPanAndZoom();
			frameRef.current = requestAnimationFrame(tick);
		};

		tick();

		return () => {
			ro.disconnect();
			if (frameRef.current) cancelAnimationFrame(frameRef.current);
			canvasEl.removeEventListener("click", handleCanvasClick);
			renderer.dispose();
			planeGeometry.dispose();
			planeMaterial.dispose();
			edges.dispose();
			(edgeLines.material as THREE.Material).dispose();
			cellMeshes.forEach((m) => {
				m.geometry.dispose();
				(m.material as THREE.Material).dispose();
			});
			controls.dispose();
		};
	}, [gameState.grid.width, gameState.grid.height]);

	// Render X/O marks and token placements
	useEffect(() => {
		const marksGroup = marksGroupRef.current;
		if (!marksGroup) return;

		// Clear previous marks
		while (marksGroup.children.length > 0) {
			const child = marksGroup.children[0];
			marksGroup.remove(child);
			if (child instanceof THREE.Mesh) {
				child.geometry.dispose();
				(child.material as THREE.Material).dispose();
			}
		}

		const { width: gridWidth, height: gridHeight, cells } = gameState.grid;
		const cellSize = 0.9;
		const spacing = 0.1;
		const totalCellSize = cellSize + spacing;

		// Token lookup and shared texture loader
		const tokenById = new Map(tokens.map((t) => [t.id, t] as const));
		// For grid cell values, choose token by player membership (e.g., Connect 4)
		const tokenForPlayer = (p: "X" | "O") =>
			tokens.find((t) => t.players.includes(p));
		const loader = new THREE.TextureLoader();
		loader.setCrossOrigin("anonymous");

		cells.forEach((value, index) => {
			if (!value) return;
			const row = Math.floor(index / gridWidth);
			const col = index % gridWidth;
			const x = (col - (gridWidth - 1) / 2) * totalCellSize;
			const y = -(row - (gridHeight - 1) / 2) * totalCellSize;

			// If a token is assigned to this player, render its image/label
			const token = tokenForPlayer(value);
			if (token && token.asset?.type === "image") {
				const tex = loader.load(token.asset.url);
				const mat = new THREE.MeshBasicMaterial({
					map: tex,
					transparent: true
				});
				const geo = new THREE.PlaneGeometry(cellSize * 0.8, cellSize * 0.8);
				const sprite = new THREE.Mesh(geo, mat);
				sprite.position.set(x, y, 0.001);
				marksGroup.add(sprite);
				return;
			}
			if (token && token.label && !token.asset) {
				const canvas = document.createElement("canvas");
				canvas.width = 128;
				canvas.height = 128;
				const ctx = canvas.getContext("2d");
				if (ctx) {
					ctx.fillStyle = "#000";
					ctx.font = "64px sans-serif";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(token.label, 64, 64);
					const tex = new THREE.CanvasTexture(canvas);
					const mat = new THREE.MeshBasicMaterial({
						map: tex,
						transparent: true
					});
					const geo = new THREE.PlaneGeometry(cellSize * 0.7, cellSize * 0.7);
					const mesh = new THREE.Mesh(geo, mat);
					mesh.position.set(x, y, 0.001);
					marksGroup.add(mesh);
				}
				return;
			}

			if (value === "X") {
				// X: two crossing lines
				const material = new THREE.LineBasicMaterial({
					color: 0x3b82f6,
					linewidth: 2
				});
				const points1 = [
					new THREE.Vector3(x - cellSize * 0.35, y + cellSize * 0.35, 0.001),
					new THREE.Vector3(x + cellSize * 0.35, y - cellSize * 0.35, 0.001)
				];
				const points2 = [
					new THREE.Vector3(x + cellSize * 0.35, y + cellSize * 0.35, 0.001),
					new THREE.Vector3(x - cellSize * 0.35, y - cellSize * 0.35, 0.001)
				];
				const geo1 = new THREE.BufferGeometry().setFromPoints(points1);
				const geo2 = new THREE.BufferGeometry().setFromPoints(points2);
				const line1 = new THREE.Line(geo1, material);
				const line2 = new THREE.Line(geo2, material);
				marksGroup.add(line1, line2);
			} else if (value === "O") {
				// O: circle
				const curve = new THREE.EllipseCurve(
					x,
					y,
					cellSize * 0.35,
					cellSize * 0.35,
					0,
					2 * Math.PI,
					false,
					0
				);
				const points = curve.getPoints(32);
				const geometry = new THREE.BufferGeometry().setFromPoints(points);
				const material = new THREE.LineBasicMaterial({
					color: 0xef4444,
					linewidth: 2
				});
				const circle = new THREE.Line(geometry, material);
				circle.position.z = 0.001;
				marksGroup.add(circle);
			}
		});

		// Draw token placements (images if provided)
		placements.forEach((p) => {
			const token = tokenById.get(p.tokenId);
			if (!token) return;
			const x = (p.col - (gridWidth - 1) / 2) * totalCellSize;
			const y = -(p.row - (gridHeight - 1) / 2) * totalCellSize;
			if (token.asset?.type === "image") {
				const tex = loader.load(token.asset.url);
				const mat = new THREE.MeshBasicMaterial({
					map: tex,
					transparent: true
				});
				const geo = new THREE.PlaneGeometry(cellSize * 0.8, cellSize * 0.8);
				const sprite = new THREE.Mesh(geo, mat);
				sprite.position.set(x, y, 0.0015);
				marksGroup.add(sprite);
			} else if (token.label) {
				const canvas = document.createElement("canvas");
				canvas.width = 128;
				canvas.height = 128;
				const ctx = canvas.getContext("2d");
				if (ctx) {
					ctx.fillStyle = "#000";
					ctx.font = "64px sans-serif";
					ctx.textAlign = "center";
					ctx.textBaseline = "middle";
					ctx.fillText(token.label, 64, 64);
					const tex = new THREE.CanvasTexture(canvas);
					const mat = new THREE.MeshBasicMaterial({
						map: tex,
						transparent: true
					});
					const geo = new THREE.PlaneGeometry(cellSize * 0.7, cellSize * 0.7);
					const mesh = new THREE.Mesh(geo, mat);
					mesh.position.set(x, y, 0.0015);
					marksGroup.add(mesh);
				}
			}
		});
	}, [
		gameState.grid.cells,
		gameState.grid.width,
		gameState.grid.height,
		tokens,
		placements
	]);

	return (
		<div ref={containerRef} className="flex relative flex-1 min-w-0 h-full">
			<canvas ref={canvasRef} className="block w-full h-full" />
			{gameState.status !== "playing" && (
				<div className="flex absolute inset-0 justify-center items-center pointer-events-none">
					<div className="px-6 py-4 text-center rounded-lg border shadow-lg backdrop-blur-sm border-border bg-background/90">
						<p className="text-xl font-semibold text-black">
							{gameState.status === "won" && `${gameState.winner} wins!`}
							{gameState.status === "draw" && "Draw!"}
						</p>
					</div>
				</div>
			)}
		</div>
	);
}

'use client';

import * as THREE from 'three';
import { Html, MapControls, PerspectiveCamera } from '@react-three/drei';
import { extend, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { useQuery } from '@tanstack/react-query';
import { inPlaceSort } from 'fast-sort';
import Fuse from 'fuse.js';
import omit from 'just-omit';
import _, { groupBy } from 'lodash';
import mergeRefs from 'merge-refs';
import {
  cloneElement,
  forwardRef,
  HTMLProps,
  memo,
  ReactElement,
  RefObject,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { CircleGeometry, Mesh } from 'three';
import { EffectComposer, LineGeometry, LineMaterial } from 'three-stdlib';
import { Line2 } from 'three-stdlib';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';

import {
  getOccupationDetails,
  getProjections
} from '@/app/[locale]/(root)/atlas/actions';
import { OccupationObject } from '@/app/[locale]/(root)/atlas/page';
import getDynamicClusterLabel from '@/components/assistant/getDynamicClusterLabel';
import OccupationDetails from '@/components/occupationDetails';
import { cn } from '@/lib/style';
import { ArrayOf, PathsWithoutIndices } from '@/lib/typing';
import { usePathname, useRouter } from '@/navigation';
import { AtlasViews, useAtlasStore } from '@/stores/atlas';
import { useUIStore } from '@/stores/ui';

import MapPin2Icon from '@public/assets/icons/mapPin2.svg';

import { industryMapping } from '../(form)/(data)/options';
import { sharedQueryOptions } from '../(form)/form';
import { CustomMapProvider } from './mapProvider';
import ResultsSearch from './resultsSearch';

extend({
  EffectComposer,
  RenderPass,
  ShaderPass,
  Line2,
  LineGeometry,
  LineMaterial,
  CircleGeometry
});

// const mapProvider = new GenerativeCityMapProvider();
// const map = new MapView(MapView.PLANAR, mapProvider);

const planeSize = 30000;

const initialCameraDistance = 12000; // ???

const maxDisplayPerGroup = 10;

const maxDisplayUngrouped = 10;

const maxDisplayGlobal = 30;

const invertedFields: string[] = ['b21-2'];

const debounce = (func: Function, delay: number) => {
  let timeout: NodeJS.Timeout;

  return (...args: any[]) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), delay);
  };
};

const PlaneMesh = memo(
  forwardRef<Mesh, {}>(function PlaneMesh({}, ref) {
    // const { dimensions } = useAtlasStore((state) => ({
    //   dimensions: state.map.dimensions
    // }));

    // const { width: mapWidth, height: mapHeight } = dimensions;
    // const onPointerMove = ({ intersections }: ThreeEvent<PointerEvent>) => {};

    function vertexShader() {
      return `
    varying vec2 vUv;

    void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `;
    }

    function fragmentShader() {
      return `
    uniform vec3 gradientStartColor; // Top-left color for the gradient (#BCEEFE)
    uniform vec3 gradientEndColor;   // Bottom-right color for the gradient (#FEC6FE)
    uniform vec3 ringColor;          // Color for the rings (#7551FF)
    uniform vec2 center;             // Center of the rings in UV space (0 to 1)
    uniform float baseRadius;        // Radius of the first ring in UV units
    varying vec2 vUv;

    void main() {
        // Step 1: Create the background gradient from top-left to bottom-right
        float gradientFactor = smoothstep(0.0, 1.0, (vUv.x + vUv.y) / 2.0);
        vec3 backgroundColor = mix(gradientStartColor, gradientEndColor, gradientFactor);

        // Make the gradient semi-transparent
        float gradientAlpha = 0.1; // Adjust this value between 0.0 (fully transparent) and 1.0 (fully opaque)
        vec4 gradientColor = vec4(backgroundColor, gradientAlpha);

        // Step 2: Initialize the final color with the gradient color
        vec4 finalColor = gradientColor;

        // Step 3: Calculate the distance from the center for ring calculations
        vec2 centeredUV = vUv - center;
        float distanceFromCenter = length(centeredUV);

        // Step 4: Define ring opacity (each ring adds 10% opacity)
        float ringOpacity = 0.15;

        // Step 5: Overlay the rings from outermost to innermost
        float accumulatedOpacity = 0.0;

        // Fourth Ring
        if (distanceFromCenter < baseRadius * 4.0) {
            accumulatedOpacity += ringOpacity;
        }
        // Third Ring
        if (distanceFromCenter < baseRadius * 3.0) {
            accumulatedOpacity += ringOpacity;
        }
        // Second Ring
        if (distanceFromCenter < baseRadius * 2.0) {
            accumulatedOpacity += ringOpacity;
        }
        // First (Innermost) Ring
        if (distanceFromCenter < baseRadius) {
            accumulatedOpacity += ringOpacity;
        }

        // Clamp the accumulated opacity
        accumulatedOpacity = clamp(accumulatedOpacity, 0.0, 1.0);

        // Step 6: Blend the ring color over the gradient based on accumulated opacity
        finalColor.rgb = mix(finalColor.rgb, ringColor, accumulatedOpacity);

        // Adjust the overall alpha to account for both gradient and rings
        finalColor.a = gradientAlpha + accumulatedOpacity * (1.0 - gradientAlpha);

        // Discard fragments outside the outermost ring
        if (distanceFromCenter > baseRadius * 4.0) {
            discard;
        }

        // Discard fragments outside the plane's UV boundaries
        if (vUv.x < 0.0 || vUv.x > 1.0 || vUv.y < 0.0 || vUv.y > 1.0) {
            discard;
        }

        // Final output color
        gl_FragColor = finalColor;
        }
    `;
    }

    const geometry = useMemo(() => {
      const geo = new THREE.PlaneGeometry(planeSize, planeSize, 1, 1);
      const uvAttribute = geo.attributes.uv!;
      for (let i = 0; i < uvAttribute.count; i++) {
        const u = uvAttribute.getX(i);
        const v = uvAttribute.getY(i);
        uvAttribute.setXY(i, u, v);
      }
      return geo;
    }, []);

    const material = new THREE.ShaderMaterial({
      uniforms: {
        gradientStartColor: { value: new THREE.Color('#BCEEFE') }, // Light blue at the top-left
        gradientEndColor: { value: new THREE.Color('#FEC6FE') }, // Light pink at the bottom-right
        ringColor: { value: new THREE.Color('#7551FF') }, // Purple color for rings
        center: { value: new THREE.Vector2(0.5, 0.5) }, // Center in UV space
        baseRadius: { value: 0.25 } // Adjust to control ring sizes
      }, // 86.6
      vertexShader: vertexShader(),
      fragmentShader: fragmentShader(),
      transparent: true,
      depthTest: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      opacity: 1
    });

    return (
      <mesh
        ref={ref}
        renderOrder={1} // ensure mesh is rendered first so it doesn't occlude other objects
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        // onPointerMove={onPointerMove}
        geometry={geometry}
      >
        <primitive attach="material" object={material} />
      </mesh>
    );
  })
);

const FXAAPass = () => {
  const { gl, scene, camera, size } = useThree();
  const composerRef = useRef<EffectComposer>();

  useEffect(() => {
    const composer = new EffectComposer(gl);
    const renderPass = new RenderPass(scene, camera);
    const fxaaPass = new ShaderPass(FXAAShader);
    fxaaPass.material.uniforms['resolution']!.value.set(
      1 / size.width,
      1 / size.height
    );

    composer.addPass(renderPass);
    composer.addPass(fxaaPass);

    composerRef.current = composer;

    return () => {
      // dispose of passes and render target
      renderPass.dispose();
      fxaaPass.dispose();
      composer.renderTarget1.dispose();
      composer.renderTarget2.dispose();
    };
  }, [gl, scene, camera, size]);

  useFrame(() => {
    composerRef.current?.render();
  }, 1);

  return null;
};

const CenteredHTMLElement = ({
  children,
  ...props
}: HTMLProps<HTMLDivElement>) => {
  const htmlRef = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const element = htmlRef.current;

  useLayoutEffect(() => {
    if (!element) return;

    requestAnimationFrame(() => {
      const rect = element.getBoundingClientRect();
      setOffset({ x: rect.width / 2, y: rect.height / 2 });
    });
  }, [element]);

  return (
    <div
      {...props}
      ref={
        props.ref
          ? mergeRefs(htmlRef, props.ref as RefObject<HTMLDivElement>)
          : htmlRef
      }
      style={{
        ...props.style,
        willChange: 'transform',
        transform: `translate(-${offset.x}px, -${offset.y}px)`
      }}
    >
      {children}
    </div>
  );
};

const FatRing = memo(function FatRing({
  center = [0, 0, 0],
  radius = 1000,
  segments = 128,
  // medium grey
  color = 0x808080,
  linewidth = 1
}: {
  center?: [number, number, number];
  radius?: number;
  segments?: number;
  color?: number;
  linewidth?: number;
}) {
  const lineRef = useRef<Line2>();
  const { size, scene } = useThree();

  const geometry = useMemo(() => new LineGeometry(), []);

  const material = useMemo(
    () =>
      new LineMaterial({
        color,
        linewidth,
        resolution: new THREE.Vector2(size.width, size.height),
        depthTest: true, // ensure depth testing is enabled
        depthWrite: false, // disable depth writing to help with flickering
        polygonOffsetFactor: -1, // adjust factor to mitigate z-fighting
        polygonOffsetUnits: -4, // adjust units to mitigate z-fighting
        polygonOffset: true,
        transparent: true
      }),
    [color, linewidth, size.width, size.height]
  );

  useEffect(() => {
    // Generate points for a circle
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(radius * Math.cos(angle), radius * Math.sin(angle), 0);
    }

    geometry.setPositions(points);
    geometry.rotateX(Math.PI / 2);

    const line = new Line2(geometry, material);

    line.computeLineDistances();
    line.renderOrder = 2; // ensure it renders on top
    lineRef.current = line;
    scene.add(lineRef.current);

    return () => {
      scene.remove(line);
    };
  }, [geometry, material, radius, segments, scene]);

  return null;
});

const colors = [
  'green',
  'blue',
  'purple',
  'orange',
  'pink',
  'brown',
  'gray'
] as const;

export const displayFields = ['a11-0', 'b11-0'] as const;

type OccupationMapProps = {
  mobileView: AtlasViews;
  format: 'mobile' | 'desktop';
  occupationDetails:
    | Awaited<ReturnType<typeof getOccupationDetails>>
    | undefined;
};

export default function OccupationMap({
  mobileView,
  format,
  occupationDetails
}: OccupationMapProps) {
  const {
    controlledMapObjects,
    setControlledMapObjects,
    dynamicClusterLabels,
    setDynamicClusterLabels,
    filtered,
    setFiltered,
    search,
    searchable,
    setSearchable,
    activeCluster,
    setActiveCluster,
    selected,
    setSelected,
    fuse,
    setFuse,
    prevFuse,
    setPrevFuse,
    handleSearch,
    setHandleSearch
  } = useAtlasStore((state) => ({
    fuse: state.data.fuse,
    setFuse: state.data.setFuse,
    prevFuse: state.data.prevFuse,
    setPrevFuse: state.data.setPrevFuse,
    handleSearch: state.data.handleSearch,
    setHandleSearch: state.data.setHandleSearch,
    search: state.data.search,
    searchable: state.data.searchable,
    setSearchable: state.data.setSearchable,
    filtered: state.data.filtered,
    setFiltered: state.data.setFiltered,
    controlledMapObjects: state.data.controlledMapObjects,
    setControlledMapObjects: state.data.setControlledMapObjects,
    dynamicClusterLabels: state.data.dynamicClusterLabels,
    setDynamicClusterLabels: state.data.setDynamicClusterLabels,
    activeCluster: state.data.activeCluster,
    setActiveCluster: state.data.setActiveCluster,
    selected: state.data.selected,
    setSelected: state.data.setSelected
  }));

  const three = useThree();
  const camera = three.camera as THREE.PerspectiveCamera;

  const controlsRef = useRef<typeof MapControls>(null);

  const planeWidth = planeSize;
  const planeHeight = planeSize;

  const controls = controlsRef.current;

  useEffect(() => {
    if (!controls) return;

    // Get the current aspect and fov from the camera
    const fov = camera.fov;
    const aspect = camera.aspect;

    // Convert FOV from degrees to radians
    const vFOV = THREE.MathUtils.degToRad(fov);

    // Calculate the horizontal FOV based on the aspect ratio
    const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);

    // Calculate the max distance where the entire plane is visible
    const maxDistanceWidth = planeWidth / (2 * Math.tan(hFOV / 2));
    const maxDistanceHeight = planeHeight / (2 * Math.tan(vFOV / 2));

    // Use Math.min to ensure the plane fits entirely within the viewport
    const maxDistance = Math.min(maxDistanceWidth, maxDistanceHeight);

    // Set controls.minDistance and controls.maxDistance
    // @ts-ignore
    controls.minDistance = 1000; // Adjust as needed for minimum zoom
    // @ts-ignore
    controls.maxDistance = maxDistance - 1000; // Subtract a buffer to prevent seeing beyond plane edges
  }, [camera, planeWidth, planeHeight, camera.aspect, camera.fov]);

  // Clamp panning and zooming in each frame
  useFrame(() => {
    if (!controls) return;

    // Get the current aspect and fov from the camera
    const fov = camera.fov;
    const aspect = camera.aspect;

    // Calculate the current distance between camera and target
    // @ts-ignore
    const distance = camera.position.distanceTo(controls.target);

    // Convert FOV from degrees to radians
    const vFOV = THREE.MathUtils.degToRad(fov);

    // Calculate the horizontal FOV based on the aspect ratio
    const hFOV = 2 * Math.atan(Math.tan(vFOV / 2) * aspect);

    // Calculate the visible height and width at the current distance
    const visibleHeight = 2 * distance * Math.tan(vFOV / 2);
    const visibleWidth = 2 * distance * Math.tan(hFOV / 2);

    // Add a small margin to prevent overshooting due to numerical errors
    const margin = 100; // Adjust as needed

    // Define the min and max panning bounds based on the visible area
    const minPanX = -planeWidth / 2 + visibleWidth / 2 + margin;
    const maxPanX = planeWidth / 2 - visibleWidth / 2 - margin;

    const minPanZ = -planeHeight / 2 + visibleHeight / 2 + margin;
    const maxPanZ = planeHeight / 2 - visibleHeight / 2 - margin;

    // Clone and clamp the target position
    // @ts-ignore
    let target = controls.target.clone();

    // Assuming the plane lies in the XZ-plane
    target.x = THREE.MathUtils.clamp(target.x, minPanX, maxPanX);
    target.z = THREE.MathUtils.clamp(target.z, minPanZ, maxPanZ);

    // Update the controls with the clamped target
    // @ts-ignore
    controls.target.copy(target);

    // Update the controls (required if damping is enabled)
    // @ts-ignore
    controls.update();
  });

  const planeMeshRef = useRef<Mesh | null>(null);

  const {
    modal: {
      Template,
      dismissible,
      wrapperStyle,
      types: { dialog, drawer }
    },
    activateModal,
    deactivateModal
  } = useUIStore((state) => ({
    modal: state.modal,
    activateModal: state.activateModal,
    deactivateModal: state.deactivateModal
  }));

  const { embeddings, rankedMatches, rhForm, setAtlasLoading } = useAtlasStore(
    (state) => ({
      embeddings: state.data.embeddings,
      rankedMatches: state.data.rankedMatches,
      rhForm: state.global.rhForm,
      setAtlasLoading: state.map.setAtlasLoading
    })
  );

  const pathname = usePathname();
  const router = useRouter();

  const avgEmbedding = useMemo(() => {
    return rankedMatches.reduce(
      (acc1, match, idx1) => {
        return (match.embedding || []).map((comp, idx2) => {
          const denormalized = (idx1 + 1) * acc1[idx2]!;
          const sum = denormalized + comp;
          const renormalized = sum / (idx1 + 2);
          return renormalized;
        });
      },
      Array.from({ length: rankedMatches[0]?.embedding.length || 0 }, () => 0)
    ) as ArrayOf<'at least', 2, number>;
  }, [rankedMatches]);

  const [allCentroids, setAllCentroids] = useState<
    {
      id: string;
      coordinates: { x: number; y: number; z: number };
      color: (typeof colors)[number] | 'black';
    }[]
  >([]);

  const [clusterColors, setClusterColors] = useState<any>({});

  const occupationIds = useMemo(
    () => rankedMatches.flatMap((match) => match.id),
    [rankedMatches]
  );

  console.log('occupationIds: ', occupationIds.length);

  const projectionQuery = useQuery({
    queryKey: ['projection', ...occupationIds],
    queryFn: async () => {
      return occupationIds.length < 1
        ? new Promise<ReturnType<typeof getProjections>>((resolve) =>
            resolve([] as unknown as ReturnType<typeof getProjections>)
          )
        : getProjections(
            rankedMatches.map((match) => [match.id, match.embedding])
          );
    }
  });

  const projections = projectionQuery.data;

  console.log('projections: ', (projections || []).length);

  const mapObjects = useMemo(() => {
    if (!projections || projections.length < 1) {
      return;
    }

    const centerX = 0;
    const centerY = 0;

    const scaleFactor = planeSize * 0.45;

    const minScore = Math.min(
      ...rankedMatches.map((match) => 1.2 - (0.2 + match.score * 0.8))
    );
    const maxScore = Math.max(
      ...rankedMatches.map((match) => 1.2 - (0.2 + match.score * 0.8))
    );

    const scaledScores = projections
      .map<
        | null
        | [
            number,
            {
              id: string;
              projection: number[];
              label: number;
            }
          ]
      >((projection) => {
        const match = rankedMatches.find(
          (match) => match.id === projection.id
        )!;

        if (!match) {
          return null;
        }

        // Convert score from [0, 1] to [0.2, 1]
        const score = 0.2 + match.score * 0.8;

        const inverted = 1.2 - score;

        // Scale to the fully fit the range [0.2, 1]
        const scaledScore =
          0.2 + ((inverted - minScore) / (maxScore - minScore)) * 0.8;

        // Randomized sign to increase visual separation
        const sign = Math.random() > 0.5 ? 1 : -1;

        return [scaledScore * sign, projection];
      })
      .filter((obj) => obj !== null);

    const processedOccupations = scaledScores.map(([score, projection]) => {
      // Convert projection.projection from cartesian to polar coordinates
      const originalCartesian = projection.projection as ArrayOf<
        'exactly',
        2,
        number
      >;

      const adjustedCartesian = [
        originalCartesian[0] - centerX,
        originalCartesian[1] - centerY
      ] as ArrayOf<'exactly', 2, number>;

      // Convert adjusted cartesian to polar
      const polar = {
        radius: Math.sqrt(
          Math.pow(adjustedCartesian[0], 2) + Math.pow(adjustedCartesian[1], 2)
        ),
        angle: Math.atan2(adjustedCartesian[1], adjustedCartesian[0])
      };

      // scale the scaledScore so the result has minScaledScore at 0 and maxScaledScore at 1
      const scaledPolar = {
        ...polar,
        radius: scaleFactor * score
      };

      // Step 2: Convert back to cartesian coordinates using the new scaled radius
      const scaledCartesian = [
        scaledPolar.radius * Math.cos(scaledPolar.angle) + centerX,
        scaledPolar.radius * Math.sin(scaledPolar.angle) + centerY
      ] as ArrayOf<'exactly', 2, number>;

      return {
        id: projection.id,
        map: {
          position: [scaledCartesian[0], 0.5, scaledCartesian[1]],
          clusterLabel: projection.label
        },
        rank: {
          score: score
        }
      };
    }) as OccupationObject[];

    console.log('processedOccupations: ', processedOccupations);

    // // Calculate the bounding box of the original positions
    // const minX = Math.min(
    //   ...processedOccupations.map((obj) => obj.map.position[0])
    // );
    // const maxX = Math.max(
    //   ...processedOccupations.map((obj) => obj.map.position[0])
    // );
    // const minZ = Math.min(
    //   ...processedOccupations.map((obj) => obj.map.position[2])
    // );
    // const maxZ = Math.max(
    //   ...processedOccupations.map((obj) => obj.map.position[2])
    // );

    // // Calculate the width and height of the bounding box
    // const boundingBoxWidth = maxX - minX;
    // const boundingBoxHeight = maxZ - minZ;

    // // Scale the points while preserving the aspect ratio
    // const scaleFactor =
    //   (planeSize * 0.8) / Math.max(boundingBoxWidth, boundingBoxHeight);

    // const centroid = {
    //   x: (scaleFactor * (minX + maxX)) / 2,
    //   z: (scaleFactor * (minZ + maxZ)) / 2
    // };

    // const gridOrigin = {
    //   x: 0,
    //   z: 0
    // };

    // const offsetX = gridOrigin.x - centroid.x;
    // const offsetZ = gridOrigin.z - centroid.z;

    return processedOccupations; /* .map((obj) => {
      // Scale the position
      const scaledPosition = [
        obj.map.position[0] * scaleFactor + offsetX,
        0.5,
        obj.map.position[2] * scaleFactor + offsetZ
      ] as ArrayOf<'exactly', 3, number>;

      obj.map.position = scaledPosition;

      return obj;
    }); */
  }, [projectionQuery.data]);

  useEffect(() => {
    const byClusterLabel = _.groupBy(mapObjects, (mapObject) => {
      return mapObject?.map?.clusterLabel!;
    });

    const clusterLabelsLoading = new Promise<void>((resolve) => {
      // check every 500ms if details are ready

      const interval = setInterval(() => {
        if (!occupationDetails) return;

        clearInterval(interval);

        const clustersLabels = Object.entries(byClusterLabel).reduce(
          (acc, [label, cluster]) => {
            if (label !== '-1') {
              const clusterOccupationLabels = cluster.map((obj) => {
                const occupationDetail = occupationDetails?.find((details) => {
                  return details.dkzId === obj.id;
                });

                const occupationDetailLabel =
                  occupationDetail?.description || '';

                return occupationDetailLabel;
              });

              return { ...acc, [label]: clusterOccupationLabels };
            }

            return acc;
          },
          {}
        );

        // getDynamicClusterLabel(clustersLabels).then((newLabels) => {
        //   setDynamicClusterLabels((prev) => newLabels);
        //   resolve();
        // });
      }, 500);
    }).then(() => {
      console.log('cluster labels loaded');
    });

    //  compute centroids for each cluster
    const clusterCentroids = Object.keys(byClusterLabel).map((label) => {
      const cluster = byClusterLabel[label]!;
      const x = cluster.reduce((acc, obj) => acc + obj?.map?.position[0]!, 0);
      const z = cluster.reduce((acc, obj) => acc + obj?.map?.position[2]!, 0);

      let clusterColor = clusterColors[label];

      if (!clusterColor) {
        // @ts-ignore
        const newColor = colors[Number(label) % colors.length];

        // @ts-ignore
        setClusterColors((prev) => ({
          ...prev,
          [label]: newColor
        }));

        clusterColor = newColor;
      }

      return {
        id: label,
        label: null,
        color: clusterColor,
        coordinates: {
          x: x / cluster.length,
          y: 0.5,
          z: z / cluster.length
        }
      };
    });

    const allCentroids = [...clusterCentroids];

    allCentroids.push({
      id: 'global',
      //@ts-ignore
      label: 'Ich',
      coordinates: {
        x: 0,
        y: 0.5,
        z: 0
      },
      color: 'black'
    });

    setAllCentroids(allCentroids);
  }, [mapObjects]);

  const anyIsLoading = projectionQuery.isLoading;

  useEffect(() => {
    setAtlasLoading({
      projection: projectionQuery.isLoading
    });
  }, [anyIsLoading]);

  useEffect(() => {
    const grouped = {
      ..._.groupBy(mapObjects || [], (mapObject) => {
        return mapObject.map!.clusterLabel;
      })
    };

    for (const label of Object.keys(grouped)) {
      const cluster = grouped[label]!;

      const sortedCluster = inPlaceSort(cluster).desc((obj) => obj.rank.score);

      if (label === '-1') {
        grouped[label] = sortedCluster; // .slice(0, maxDisplayUngrouped);
      } else {
        // @ts-ignore
        grouped[label] = sortedCluster; // .slice(0, maxDisplayPerGroup);
      }
    }

    console.log(
      'controlled map objects: ',
      Object.values(grouped).flat().length
    );

    setControlledMapObjects(grouped);
  }, [mapObjects]);

  const globalCentroid = allCentroids.find(
    (centroid) => centroid.id === 'global'
  )!;

  const panToTarget = (position: THREE.Vector3) => {
    if (!controls) return;

    console.log('panToTarget position: ', position);

    // Calculate the direction vector from the camera to the current target
    //@ts-ignore
    const distanceToTarget = camera.position.distanceTo(controls.target);

    // Update the target of the MapControls to the new target position
    //@ts-ignore
    controls.target.set(...position);

    // Recalculate the camera position to maintain the original distance from the new target
    const direction = new THREE.Vector3()
      //@ts-ignore
      .subVectors(camera.position, controls.target)
      .normalize()
      .multiplyScalar(distanceToTarget); // Maintain original distance

    //@ts-ignore
    camera.position.copy(controls.target).add(direction);

    // Update the controls to reflect the change
    //@ts-ignore
    controls.update();
  };

  useEffect(() => {
    if (selected) {
      console.log('inside useEffect selected: ', selected);
      const selectedObject = Object.values(searchable)
        .flat()
        .find((obj) => obj.id === selected);

      // setTimeout(() => {
      if (selectedObject) {
        console.log('inside useEffect selectedObject: ', selectedObject);

        const position = new THREE.Vector3().fromArray(
          selectedObject.map!.position
        );

        selectedObject.map && panToTarget(position);
      }
      // }, 600);
    }
  }, [selected]);

  const handleAfterRender = () => {
    if (!controls) return;

    //@ts-ignore
    controls.update();
  };

  const { invalidate, gl } = useThree();

  useEffect(() => {
    // force a single re-render
    invalidate();

    gl.domElement.addEventListener('afterRender', handleAfterRender);

    return () => {
      gl.domElement.removeEventListener('afterRender', handleAfterRender);
    };
  }, [activeCluster]);

  const searchableFlat = useMemo(() => {
    const numClusters = Object.keys(controlledMapObjects).length;
    const occupationsPerCluster = Math.floor(maxDisplayGlobal / numClusters);

    return (
      Object.values(controlledMapObjects)
        // .map((cluster) => {
        //   // ascending sort
        //   cluster.sort((a, b) => a.rank.score - b.rank.score);
        //   return cluster.slice(0, occupationsPerCluster);
        // })
        .flat()
        // .filter((obj) =>
        //   activeCluster ? String(obj.map?.clusterLabel) === activeCluster : true
        // )
        .sort((a, b) => {
          // @ts-ignore
          const itemA = a?.item || a;
          // @ts-ignore
          const itemB = b?.item || b;
          return itemB.rank.score - itemA.rank.score;
        })
        .slice(0, maxDisplayGlobal)
        .map((obj) => {
          const details = occupationDetails?.find((details) => {
            return details.dkzId === obj.id;
          });

          return {
            ...omit(obj, ['details']),
            details
          } as const;
        })
    );
  }, [controlledMapObjects, occupationDetails]);

  useEffect(() => {
    if (!searchableFlat.length) return;

    if (fuse) {
      setPrevFuse(fuse);
    }

    const newFuse = new Fuse(searchableFlat, {
      keys: [
        'details.name',
        'details.description',
        'details.shortDescription'
        // 'details.infofields.content'
      ] satisfies PathsWithoutIndices<typeof searchable>[],
      distance: 999999,
      includeMatches: true,
      findAllMatches: true,
      threshold: 0.3,
      fieldNormWeight: 2,
      isCaseSensitive: false,
      includeScore: true,
      shouldSort: false
    });

    setFuse(newFuse);

    const searchable = groupBy(
      searchableFlat,
      (result) => result.map?.clusterLabel
    );

    setSearchable(searchable);
  }, [searchableFlat]);

  useEffect(() => {
    let localHandleSearch = handleSearch;

    if (fuse !== prevFuse) {
      const newHandleSearch = debounce(() => {
        if (!fuse) return;

        const results = fuse.search(search);
        const grouped = groupBy(
          results,
          (result) => result.item.map?.clusterLabel
        );

        setFiltered(grouped);
      }, 200);

      localHandleSearch = newHandleSearch;
      setHandleSearch(newHandleSearch);
    }

    if (localHandleSearch) {
      localHandleSearch();
    }
  }, [fuse, search]);

  useEffect(() => {
    if (!selected) return;

    const obj = searchableFlat.find((obj) => {
      return obj?.id === selected;
    });

    if (activeCluster !== String(obj?.map?.clusterLabel)) {
      setActiveCluster(String(obj?.map?.clusterLabel));
    }
  }, [selected]);

  return (
    <>
      <PerspectiveCamera
        makeDefault
        position={[0, initialCameraDistance, 0]}
        rotation={[0, 0, 0]}
        fov={75} // Adjust to a more typical value
        near={0.1}
        far={100000} // Increase far plane to accommodate large
      />
      <MapControls
        //@ts-ignore
        ref={controlsRef}
        enableDamping={false} // disable for performance
        dampingFactor={0.5}
        maxPolarAngle={0} // keep the camera looking straight down
        minPolarAngle={0}
        maxAzimuthAngle={Math.PI} // keep the camera looking straight down
        minAzimuthAngle={Math.PI}
        enablePan={true}
        minDistance={1}
        maxDistance={20000}
        autoRotate={false}
        // enabled={(Object.values(searchable).flat().length || 0) > 0}
      />
      <ambientLight intensity={1} />
      <FXAAPass />
      <PlaneMesh ref={planeMeshRef} />
      <group>
        {(search === '' ? Object.entries(searchable) : Object.entries(filtered))
          .reduce(
            // @ts-ignore
            (acc, [label, cluster]) => {
              const flattenedPairs = cluster.map((obj) => {
                return [label, obj] as const;
              });

              return [...acc, ...flattenedPairs];
            },
            []
          )
          .map(([clusterLabel, obj]) => {
            // @ts-ignore
            const { id, map, details } = obj?.item ? obj.item : obj;

            const hasCluster = Number(clusterLabel) >= 0;
            const clusterColor = hasCluster
              ? clusterColors[clusterLabel as string]
              : false;

            const position = map!.position;

            return (
              <Html
                key={`occupation-${id}`}
                position={position}
                zIndexRange={id === selected ? [49, 49] : [10, 47]}
              >
                <CenteredHTMLElement
                  id={`${id}:position-${position}:selected-${selected === id}`}
                  key={`position-${position}:selected-${selected === id}`}
                  className={cn(
                    'occupation-css3d-wrapper text-primary4 text-[0.5rem] w-12 h-12',
                    id === selected && 'w-14 h-14'
                  )}
                  onClick={() => {
                    setSelected(id);
                    activateModal(
                      () =>
                        function ModalContent() {
                          return <OccupationDetails id={id} />;
                        },
                      (defaultState) => ({
                        ...defaultState,
                        dismissible: format === 'desktop' ? true : false,
                        onClose: async (res) => {
                          console.log(
                            'occupationDetails onClose called; further calling activateModal on ResultsSearch'
                          );
                          res();
                          return format === 'desktop'
                            ? deactivateModal()
                            : deactivateModal().then(() =>
                                activateModal(
                                  () =>
                                    function ModalContent() {
                                      return <ResultsSearch />;
                                    },
                                  (defaultState) => ({
                                    ...defaultState,
                                    dismissible: false,
                                    types: {
                                      ...defaultState.types,
                                      drawer: {
                                        snapPoints: [0.2, 0.4, 1],
                                        activeSnapPoint: 0.4,
                                        modalMode: false
                                      }
                                    }
                                  })
                                )
                              );
                        },
                        types: {
                          ...defaultState.types,
                          drawer: {
                            snapPoints: [1],
                            activeSnapPoint: 1,
                            modalMode: true
                          }
                        }
                      })
                    );
                  }}
                >
                  <div
                    className={cn(
                      'w-full h-full relative overflow-hidden',
                      id === selected && 'animate-bounce'
                    )}
                  >
                    <MapPin2Icon
                      id={`${position}`}
                      className={cn(
                        'w-full h-full absolute left-0 top-0 text-[#130160]',
                        id === selected && 'text-[#7551FF]'
                      )}
                    />
                    <div
                      className={cn(
                        'absolute left-3 top-[0.4rem] w-6 h-6 p-1 border rounded-full smooth',
                        id === selected &&
                          'w-[1.8rem] h-[1.8rem] left-[0.88rem] border-none'
                      )}
                      style={{
                        backgroundColor: 'white',
                        borderColor: clusterColor || 'black',
                        borderWidth: '2px',
                        boxSizing: 'border-box'
                      }}
                    >
                      {cloneElement(
                        (() => {
                          const kldbCode =
                            details?.code
                              .split(' ')[1]
                              ?.split('-')[0]
                              ?.trim() || '';

                          const mapping = industryMapping.find((obj) => {
                            if (kldbCode.startsWith(obj.prefix)) {
                              return obj;
                            }
                          });

                          return (
                            (mapping?.icon.lucide as ReactElement) || (
                              <div></div>
                            )
                          );
                        })(),
                        {
                          className: cn(
                            'w-full h-full',
                            id === selected
                              ? 'text-[#7551FF]'
                              : 'text-[#130160]'
                          )
                        }
                      )}
                    </div>
                  </div>
                  <div className="line-clamp-1 light:text-primary3 light:bg-primary4 dark:text-primary4 dark:bg-primary3 text-[0.5rem] font-extrabold w-24 break-all py-[1px] px-1 rounded-lg text-center">
                    {details?.name || ''}
                  </div>
                </CenteredHTMLElement>
              </Html>
            );
          })}
      </group>
      <group>
        {globalCentroid && (
          <Html
            key={`centroid-global`}
            position={(() => {
              const position = [
                globalCentroid.coordinates.x,
                10,
                globalCentroid.coordinates.z
              ] as ArrayOf<'exactly', 3, number>;

              return position;
            })()}
            zIndexRange={[49]}
          >
            <CenteredHTMLElement className="flex flex-col justify-center items-center relative">
              {globalCentroid.color ? (
                <>
                  <div className="w-10 h-10 rounded-full border-2 border-primary3 flex justify-center items-center">
                    <div className="w-4 h-4 bg-primary3 rounded-full" />
                  </div>
                  <div className="absolute top-full text-xs font-extrabold w-24 light:bg-primary4 dark:bg-primary3 text-[0.5rem] break-all py-[1px] px-1 rounded-lg text-center text-primary3">
                    {/* @ts-ignore */}
                    {globalCentroid.label}
                  </div>
                </>
              ) : null}
            </CenteredHTMLElement>
          </Html>
        )}
      </group>
    </>
  );
}

import _ from "lodash";
import {
	querySelector,
	coordToId,
	setCSSVar,
	toggleClass,
	Coordinate2D,
	idToCoord,
	removeChildren,
	map2wise
} from "./utils";

///////////////////////////////
//// Initialize Game State ////
///////////////////////////////

const defaultGameParams = {
	delay: 100, // ms
	rows: 23,
	cols: 27,
	gridSquareSize: 20, // px
	hoodRadius: 1
};

type GameParams = typeof defaultGameParams;

const gameParams: GameParams = _.cloneDeep(defaultGameParams);

const messages = querySelector("#messages");
messages.innerHTML = "<h4>Click start to evolve the universe</h3>";

const gameGrid = querySelector("#game-grid");

const optionsHoodRadius = querySelector(
	"#options-hood-radius > input"
) as HTMLInputElement;

optionsHoodRadius.max = String(20);
optionsHoodRadius.min = String(1);
optionsHoodRadius.value = String(gameParams.hoodRadius);

const adjacencySelect = querySelector(
	"#options-adjacency > select"
) as HTMLSelectElement;

const adjacencyLinearBlock = querySelector("#linear-adjacency");
const adjacencyNonLinearBlock = querySelector("#non-linear-adjacency");

if (adjacencySelect.value == "linear") {
	adjacencyNonLinearBlock.classList.toggle("hide");
} else {
	adjacencyLinearBlock.classList.toggle("hide");
}

adjacencySelect.addEventListener("input", () => {
	adjacencyNonLinearBlock.classList.toggle("hide");
	adjacencyLinearBlock.classList.toggle("hide");
});

const gameState = {
	liveCells: new Set() as Set<string>,
	frozen: false,
	done: true
};

function generateGridCells() {
	setCSSVar("--grid-square-size", gameParams.gridSquareSize);

	gameParams.rows = Math.floor(
		(window.innerHeight * 0.9) / gameParams.gridSquareSize
	);
	gameParams.cols = Math.floor(window.innerWidth / gameParams.gridSquareSize);

	setCSSVar("--rows", gameParams.rows);
	setCSSVar("--cols", gameParams.cols);

	for (let j = gameParams.rows - 1; j >= 0; j--) {
		for (let i = 0; i < gameParams.cols; i++) {
			const gridSquare = document.createElement("div");
			gridSquare.id = coordToId([i, j]);
			gridSquare.classList.add("grid-square");
			gameGrid.appendChild(gridSquare);
		}
	}

	const defaultLiveCells = [
		[4, 5],
		[5, 5],
		[6, 4],
		[6, 6],
		[7, 5],
		[8, 5]
	] as Array<Coordinate2D>;

	// create default live cells
	defaultLiveCells.forEach((coord) => {
		const id = coordToId(coord);
		gameState.liveCells.add(id);
		const square = querySelector(`#${id}`);
		toggleClass(square, "live-cell");
	});
}

generateGridCells();

///////////////////////////
//// State Transitions ////
///////////////////////////

function filterInvalid([column, row]: Coordinate2D) {
	return (
		row < 0 ||
		row > gameParams.rows - 1 ||
		column < 0 ||
		column > gameParams.cols - 1
	);
}

const basisVectors = [
	[0, 1],
	[0, -1],
	[1, 0],
	[-1, 0]
] as Array<Coordinate2D>;

const directions = map2wise(([x1, y1], [x2, y2]) => {
	return [x1 + x2, y1 + y2];
}, basisVectors);

function horAdj([x, y]: Coordinate2D) {
	const left = [x - 1, y];
	const right = [x + 1, y];
	const adjacents = [left, right];
	return adjacents as Array<Coordinate2D>;
}

function vertAdj([x, y]: Coordinate2D) {
	const above = [x, y - 1];
	const below = [x, y + 1];
	const adjacents = [above, below];
	return adjacents as Array<Coordinate2D>;
}

function backDiaAdj([x, y]: Coordinate2D) {
	const topleft = [x - 1, y - 1];
	const bottomright = [x + 1, y + 1];
	const adjacents = [topleft, bottomright];
	return adjacents as Array<Coordinate2D>;
}

function forDiaAdj([x, y]: Coordinate2D) {
	const topright = [x + 1, y - 1];
	const bottomleft = [x - 1, y + 1];
	const adjacents = [topright, bottomleft];
	return adjacents as Array<Coordinate2D>;
}

const adjFuncMap = {
	"option-adjacency-hor": horAdj,
	"option-adjacency-vert": vertAdj,
	"option-adjacency-backdia": backDiaAdj,
	"option-adjacency-fordia": forDiaAdj
};

const adjModeElementMap = {
	linear: adjacencyLinearBlock,
	"non-linear": adjacencyNonLinearBlock
};

function computeActiveAdjFuncs() {
	const activeAdjFuncs = [];
	const mode = adjacencySelect.value as keyof typeof adjModeElementMap;
	const adjFuncBools = Array.from(
		adjModeElementMap[mode].querySelectorAll("div")
	);

	for (const adjFuncBool of adjFuncBools) {
		const checkbox = adjFuncBool.querySelector("input") as HTMLInputElement;
		if (checkbox.checked) {
			const funcId = adjFuncBool.id as keyof typeof adjFuncMap;
			activeAdjFuncs.push(adjFuncMap[funcId]);
		}
	}
	return activeAdjFuncs;
}

function checkUpdateRules(
	id: string,
	isAlive: boolean,
	count: number
): CellUpdate {
	if (isAlive) {
		if (count < 2 || count > 3) {
			return {
				id,
				action: "kill"
			};
		}
	} else {
		if (count == 3) {
			return {
				id,
				action: "revive"
			};
		}
	}

	return {
		id,
		action: "nothing"
	};
}

function computeUpdates(
	coordinate: Coordinate2D,
	cellUpdateMemo: Set<string>,
	depth = 0
): Array<CellUpdate> {
	const id = coordToId(coordinate);
	const activeAdjFuncs = computeActiveAdjFuncs();

	const compositeAdjacencyFunction = function (coord: Coordinate2D) {
		const adjacents: Array<Coordinate2D> = [];

		for (const adjFunc of activeAdjFuncs) {
			adjacents.push(...adjFunc(coord));
		}
		return adjacents;
	};

	const neighborhood = compositeAdjacencyFunction(coordinate);
	let cellUpdates = [];

	if (depth >= gameParams.hoodRadius) {
		if (cellUpdateMemo.has(id)) {
			return [];
		}

		cellUpdateMemo.add(id);
		let aliveCellsCounter = 0;

		for (const neighbor of neighborhood) {
			const id = coordToId(neighbor);
			if (gameState.liveCells.has(id)) {
				aliveCellsCounter++;
			}
		}

		const isAlive = gameState.liveCells.has(id);
		const update = checkUpdateRules(id, isAlive, aliveCellsCounter);

		return [update];
	} else {
		neighborhood.push(coordinate);
		for (const cell of neighborhood) {
			cellUpdates.push(
				...computeUpdates(cell, cellUpdateMemo, depth + 1)
			);
		}
	}

	return cellUpdates;
}

gameGrid.addEventListener("click", (event) => {
	const target = event.target as HTMLElement;
	if (target.matches("#game-grid > .grid-square") && !gameState.frozen) {
		target.classList.toggle("live-cell");

		if (gameState.liveCells.has(target.id)) {
			gameState.liveCells.delete(target.id);
		} else {
			gameState.liveCells.add(target.id);
		}
	}
});

///////////////////
//// Game Loop ////
///////////////////

function gameLoop() {
	if (!gameState.done) {
		updateGameState();
		setTimeout(() => {
			window.requestAnimationFrame(gameLoop);
		}, gameParams.delay);
	}
}

const cellUpdateActions = ["kill", "revive", "nothing"] as const;

type CellUpdate = {
	id: string;
	action: (typeof cellUpdateActions)[number];
};

function updateGameState() {
	const cellUpdateMemo = new Set() as Set<string>;
	let cellUpdates: Array<CellUpdate> = [];

	for (const liveCell of gameState.liveCells) {
		const coordinate = idToCoord<Coordinate2D>(liveCell);
		cellUpdates.push(...computeUpdates(coordinate, cellUpdateMemo));
	}

	for (const cellUpdate of cellUpdates) {
		const id = cellUpdate.id;
		const coordinate = idToCoord<Coordinate2D>(id);

		switch (cellUpdate.action) {
			case "revive":
				gameState.liveCells.add(id);
				if (!filterInvalid(coordinate)) {
					const deadCell = querySelector(`#${id}`);
					toggleClass(deadCell, "live-cell");
				}
				break;
			case "kill":
				gameState.liveCells.delete(id);
				if (!filterInvalid(coordinate)) {
					const liveCell = querySelector(`#${id}`);
					toggleClass(liveCell, "live-cell");
				}
				break;
			case "nothing":
				break;
		}
	}
}

const startButton = querySelector("#button-start");

startButton.addEventListener("click", () => {
	if (!gameState.frozen) {
		gameState.done = false;
		gameState.frozen = true;
		gameLoop();
	}
});

const resetButton = querySelector("#button-reset");

resetButton.addEventListener("click", () => {
	gameState.liveCells = new Set();
	gameState.done = true;
	gameState.frozen = false;

	removeChildren(gameGrid);
	generateGridCells();

	messages.innerHTML = "<h4>How does it feel to be God?</h4>";
});

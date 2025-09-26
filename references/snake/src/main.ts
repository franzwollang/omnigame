import {
	randomCoordinate,
	styleSquare,
	mod,
	coordToId,
	idToCoord
} from "./utils";

///////////////////////
//// Prepare Board ////
///////////////////////

const snakeGrid = document.querySelector("#snake-grid") as HTMLDivElement;
const messages = document.querySelector("#messages") as HTMLDivElement;

const rows = 21;
const columns = 21;

for (let i = 0; i < rows; i++) {
	for (let j = 0; j < columns; j++) {
		const gridSquare = document.createElement("div");
		gridSquare.id = coordToId([i, j]);
		gridSquare.classList.add("grid-square");
		snakeGrid.appendChild(gridSquare);
	}
}

///////////////////////////////
//// Initialize Game State ////
///////////////////////////////

const defaultDelay = 200; // ms

// array of coordinates specifying snake
// first element is always head of snake
// last element is tail of snake
const defaultSnake = ["11-11", "12-11", "13-11"];

// top left starting
// +1 for rows is downward, -1 is upwards
// +1 for columns is rightward, -1 is leftward
const defaultSnakeDirection = {
	v: -1,
	h: 0
};

// array of coordinates specifying apples
function getApple() {
	const [appleRow, appleColumn] = randomCoordinate(rows, columns);
	return coordToId([appleRow, appleColumn]);
}

function generateApples() {
	let again = true;
	const apples = [];

	while (again) {
		const newApple = getApple();

		if (snake.includes(newApple)) {
			continue;
		} else {
			again = false;
			apples.push(newApple);
		}
	}
	return apples;
}

const music = document.querySelector("#music") as HTMLAudioElement;
music.loop = true;

// sound effects
const appleBite = new Audio("./assets/audio/apple-bite.mp3");
appleBite.playbackRate = 1.5;

let delay = defaultDelay;
let score = 0;
let snake = defaultSnake.slice(0);
// make copy of default snake direction object
let snakeDirection = Object.assign({}, defaultSnakeDirection);
let apples = generateApples();

///////////////////////////
//// State Transitions ////
///////////////////////////

// color snake squares
snake.forEach((coordinateId) => {
	const square = document.getElementById(coordinateId) as HTMLDivElement;
	styleSquare(square, "snake-square");
});

// color apple squares
apples.forEach((coordinateId) => {
	const square = document.getElementById(coordinateId) as HTMLDivElement;
	styleSquare(square, "apple-square");
});

// change direction of movement when pressing arrow keys
// make sure you can't move backwards
document.addEventListener("keydown", (event) => {
	switch (event.key) {
		case "ArrowLeft":
			if (snakeDirection.v == 0 && snakeDirection.h == 1) {
				break;
			} else {
				snakeDirection.v = 0;
				snakeDirection.h = -1;
			}
			break;
		case "ArrowUp":
			if (snakeDirection.v == 1 && snakeDirection.h == 0) {
				break;
			} else {
				snakeDirection.v = -1;
				snakeDirection.h = 0;
			}
			break;
		case "ArrowRight":
			if (snakeDirection.v == 0 && snakeDirection.h == -1) {
				break;
			} else {
				snakeDirection.v = 0;
				snakeDirection.h = 1;
			}
			break;
		case "ArrowDown":
			if (snakeDirection.v == -1 && snakeDirection.h == 0) {
				break;
			} else {
				snakeDirection.v = 1;
				snakeDirection.h = 0;
			}
			break;
	}
});

function moveSnake() {
	const head = snake[0];
	const tail = snake[snake.length - 1];

	const headVH = idToCoord(head);
	const newV = Number(headVH[0]) + snakeDirection.v;
	const newH = Number(headVH[1]) + snakeDirection.h;

	// wrap snake around if moves out of bounds
	const newSnakeV = mod(newV, rows);
	const newSnakeH = mod(newH, columns);

	const newSnakeId = coordToId([newSnakeV, newSnakeH]);

	// add styling to new snake head
	const newSnakeSquare = document.getElementById(
		newSnakeId
	) as HTMLDivElement;

	if (snake.includes(newSnakeSquare.id)) {
		console.log("Snake encountered!");
		// reset styling of existing snake
		snake.forEach((coordinateId) => {
			const square = document.getElementById(
				coordinateId
			) as HTMLDivElement;
			styleSquare(square, "snake-square");
		});
		// reset styling of existing apple
		apples.forEach((coordinateId) => {
			const square = document.getElementById(
				coordinateId
			) as HTMLDivElement;
			styleSquare(square, "apple-square");
		});
		// reset state to defaults
		snake = defaultSnake.slice(0);
		snakeDirection = Object.assign({}, defaultSnakeDirection);
		score = 0;
		delay = defaultDelay;
		// style new snake
		snake.forEach((coordinateId) => {
			const square = document.getElementById(
				coordinateId
			) as HTMLDivElement;
			styleSquare(square, "snake-square");
		});
		// style new apples
		apples.forEach((coordinate) => {
			const square = document.getElementById(
				coordinate
			) as HTMLDivElement;
			styleSquare(square, "apple-square");
		});
		return;
	}

	// style new snake head
	styleSquare(newSnakeSquare, "snake-square");
	// add new snake head to snake array
	snake.unshift(newSnakeId);

	if (apples.includes(newSnakeSquare.id)) {
		console.log("Apple encountered!");
		appleBite.play();

		newSnakeSquare.classList.remove("apple-square");
		score++;

		// add new apple
		apples = generateApples();
		const square = document.getElementById(apples[0]) as HTMLDivElement;
		styleSquare(square, "apple-square");

		// increase speed
		delay = Math.max(100, delay - 5);
	} else {
		// remove styling from tail square
		const tailSquare = document.getElementById(tail) as HTMLDivElement;
		styleSquare(tailSquare, "snake-square");

		// remove tail from snake array
		snake.pop();
	}
}

///////////////////
//// Game Loop ////
///////////////////

let done = false;

function gameLoop() {
	if (!done) {
		updateGameState();
		setTimeout(() => {
			window.requestAnimationFrame(gameLoop);
		}, delay);
	}
}

function updateGameState() {
	// call checks and transitions here
	moveSnake();
	const scoreSpan = document.querySelector(
		"#score > span"
	) as HTMLSpanElement;
	scoreSpan.innerText = String(score);
}

gameLoop();

// prevent scrolling when using arrow keys
window.addEventListener("keydown", function (event) {
	const keysDisabledDefault = [
		"Space",
		"ArrowUp",
		"ArrowDown",
		"ArrowLeft",
		"ArrowRight"
	];

	if (keysDisabledDefault.includes(event.key)) {
		event.preventDefault();
	}
});

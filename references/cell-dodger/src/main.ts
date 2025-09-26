import _ from "lodash";

// define types
type Coordinate = [number, number];

type GridEntity = {
    x: number;
    y: number;
};

interface Player extends GridEntity {
    controls: {
        lastKeyPressed: string | null;
        movement: { left: string; up: string; right: string; down: string };
    };
}
type Players = Player[];

interface Enemy extends GridEntity {}
type Enemies = Enemy[];

interface Coin extends GridEntity {}
type Coins = Coin[];

type Predicate<T> = (element1: T, element2: T) => boolean;

// utility functions
function getRandomInt(max: number) {
    return Math.floor(Math.random() * max);
}

function randomCoordinate(xRange: number, yRange: number): Coordinate {
    return [getRandomInt(xRange), getRandomInt(yRange)];
}

function coordToId([x, y]: Coordinate): string {
    return `xy_${x}-${y}`;
}

function idToCoord(id: string): Coordinate {
    return id.replace("xy_", "").split("-").map(Number) as Coordinate;
}

function removeChildren(element: Element) {
    while (element.lastElementChild) {
        element.removeChild(element.lastElementChild);
    }
}

function mod(n: number, m: number) {
    return ((n % m) + m) % m;
}

function setDefaultInputs(
    element: HTMLInputElement,
    gameParam: keyof GameParams
) {
    element.value = gameParams[gameParam].toString();
}

// set config & state

const defaultGameParams = {
    delay: 300, // ms
    rows: 20,
    columns: 20,
    numPlayers: 1,
    numEnemies: 5,
    numCoins: 2,
    minEnemyDist: 2,
};

type GameParams = typeof defaultGameParams;

const gameParams: GameParams = _.cloneDeep(defaultGameParams);

function updateInput(element: HTMLInputElement, gameParam: keyof GameParams) {
    element.addEventListener("input", () => {
        gameParams[gameParam] = Number(element.value);
        console.log(gameParams[gameParam]);
        gameOver = false;
        gameStarted = false;
        initGame();
        setTimeout(() => {
            gameLoop();
        }, gameParams.delay);
        console.log(gameState.players, gameState.enemies, gameParams.delay);
    });
}

const grid = document.querySelector("#game-grid") as HTMLElement;
const noPlayersInput = document.querySelector("#noPlayers") as HTMLInputElement;
const noEnemiesInput = document.querySelector("#noEnemies") as HTMLInputElement;
const defaultDelayInput = document.querySelector(
    "#defaultDelay"
) as HTMLInputElement;
const scoreDisplay = document.querySelector("#score") as HTMLElement;

const players: Players = [];
const enemies: Enemies = [];
const coins: Coins = [];

const gameState = {
    players,
    enemies,
    coins,
    allEntities: [players, enemies, coins],
    controlPlayerMap: {} as Record<string, number>,
    score: 0,
    delay: 300,
};

setDefaultInputs(noPlayersInput, "numPlayers");
setDefaultInputs(noEnemiesInput, "numEnemies");
setDefaultInputs(defaultDelayInput, "delay");

updateInput(noPlayersInput, "numPlayers");
updateInput(noEnemiesInput, "numEnemies");
updateInput(defaultDelayInput, "delay");

const playerColor: string = "bg-red-500";
const enemyColor: string = "bg-blue-500";
const coinColor: string = "bg-yellow-500";
const bgColor: string = "bg-zinc-300";

function setGrid() {
    for (let y = 0; y < gameParams.columns; y++) {
        for (let x = 0; x < gameParams.rows; x++) {
            const gridSquare: HTMLElement = document.createElement("div");
            gridSquare.id = coordToId([x, y]);
            gridSquare.classList.add(
                "border-[1px]",
                "border-black",
                "w-[30px]",
                "h-[30px]"
            );
            grid.appendChild(gridSquare);
        }
    }
}

// define predicate
function collisionPred<T extends GridEntity>(entity1: T, entity2: T) {
    return entity1.x == entity2.x && entity1.y == entity2.y;
}

function minDistPred<T extends GridEntity>(entity1: T, entity2: T) {
    // console.log("mindDist pred: ", entity1, entity2);
    return (
        dist2([entity1.x, entity1.y], [entity2.x, entity2.y]) >=
        gameParams.minEnemyDist
    );
}

function generateEntities<T extends GridEntity>(
    quantity: number,
    predicates: Predicate<T>[],
    entityArrays: Array<T[]>
) {
    const newEntities = [] as T[];

    let combinedEntities = [] as T[];
    for (const entityArray of entityArrays) {
        combinedEntities = [...combinedEntities, ...entityArray];
    }

    while (newEntities.length < quantity) {
        const [x, y] = randomCoordinate(gameParams.rows, gameParams.columns);
        const entity = { x, y } as T;

        let flag = true;
        for (const predicate of predicates) {
            flag = flag && !combinedEntities.some(predicate.bind({}, entity));
        }

        if (flag) {
            newEntities.push(entity);
        }
    }
    return newEntities;
}

function colorSquare(id: string, color: string) {
    const square = document.getElementById(id) as HTMLElement;
    square.classList.toggle(color);
}

function applyEntityColor<T extends GridEntity>(color: string, entities: T[]) {
    for (const entity of entities) {
        const entityId = coordToId([entity.x, entity.y]);
        colorSquare(entityId, color);
    }
}

// init player controls
const directionActions = {
    left: (player: Player) => {
        applyEntityColor(playerColor, [player]);
        player.x = mod(player.x - 1, gameParams.columns);
        checkIfScored(player);
        applyEntityColor(playerColor, [player]);
    },
    right: (player: Player) => {
        applyEntityColor(playerColor, [player]);
        player.x = mod(player.x + 1, gameParams.columns);
        checkIfScored(player);
        applyEntityColor(playerColor, [player]);
    },
    up: (player: Player) => {
        applyEntityColor(playerColor, [player]);
        player.y = mod(player.y - 1, gameParams.rows);
        checkIfScored(player);
        applyEntityColor(playerColor, [player]);
    },
    down: (player: Player) => {
        applyEntityColor(playerColor, [player]);
        player.y = mod(player.y + 1, gameParams.rows);
        checkIfScored(player);
        applyEntityColor(playerColor, [player]);
    },
};

type Directions = keyof typeof directionActions;

const player1Default = {
    left: "ArrowLeft",
    up: "ArrowUp",
    right: "ArrowRight",
    down: "ArrowDown",
};
const player2Default = {
    left: "a",
    up: "w",
    right: "d",
    down: "s",
};

const playerDefaults = [player1Default, player2Default];

function initEntities() {
    gameState.players = [];
    gameState.coins = [];
    gameState.enemies = [];
    gameState.allEntities = [
        gameState.players,
        gameState.coins,
        gameState.enemies,
    ];

    const playerLocations = generateEntities(
        gameParams.numPlayers,
        [collisionPred],
        gameState.allEntities
    ) as Players;
    gameState.players = playerLocations.map((player, i) => {
        player.controls = {
            lastKeyPressed: null,
            movement: playerDefaults[i],
        };
        return player;
    });

    gameState.controlPlayerMap = gameState.players.reduce(
        (acc, player, ind) => {
            Object.values(player.controls.movement).forEach((key) => {
                acc[key] = ind;
            });

            return acc;
        },
        {} as Record<string, number>
    );

    gameState.coins = generateEntities(
        gameParams.numCoins,
        [collisionPred],
        gameState.allEntities
    );

    gameState.enemies = generateEntities(
        gameParams.numEnemies,
        [collisionPred, minDistPred],
        gameState.allEntities
    );

    applyEntityColor(playerColor, gameState.players);
    applyEntityColor(enemyColor, gameState.enemies);
    applyEntityColor(coinColor, gameState.coins);
}

// init the score
function displayScore() {
    scoreDisplay.innerText = String(gameState.score);
}

function initGame() {
    gameState.score = 0;
    displayScore();
    removeChildren(grid);
    setGrid();
    initEntities();
}

function checkIfScored(player: Player) {
    for (const [index, coin] of gameState.coins.entries()) {
        if (collisionPred(player, coin)) {
            applyEntityColor(coinColor, [coin]);
            // remove the coin
            gameState.coins.splice(index, 1);
            // add new coin
            const newCoins = generateEntities(
                1,
                [collisionPred],
                gameState.allEntities
            );
            gameState.coins.push(...newCoins);
            applyEntityColor(coinColor, newCoins);
            gameState.score++;
            displayScore();
        }
    }
}

// register the last key pressed during the animation frame
document.addEventListener("keydown", (event) => {
    const playerIndex = gameState.controlPlayerMap[event.key];
    gameStarted = true;
    if (typeof playerIndex == "number") {
        const player = gameState.players[playerIndex];
        player.controls.lastKeyPressed = event.key;
    }
});

// move the player with arrow keys
function movePlayers(players: Players) {
    for (const player of players) {
        const moveKey = player.controls.lastKeyPressed;
        if (moveKey === null) {
            continue;
        }
        const moveDirection = _.invert(Object(player.controls.movement))[
            moveKey
        ] as Directions;

        const moveFunc = directionActions[moveDirection];
        moveFunc(player);
        player.controls.lastKeyPressed = null;
    }
}

function vecAdd2([x1, y1]: Coordinate, [x2, y2]: Coordinate): Coordinate {
    return [x1 + x2, y1 + y2];
}

function vecSub2([x1, y1]: Coordinate, [x2, y2]: Coordinate): Coordinate {
    return [x2 - x1, y2 - y1];
}

function vecSub2Torus(
    [rangeX, rangeY]: [number, number],
    [x1, y1]: Coordinate,
    [x2, y2]: Coordinate
): Coordinate {
    let dx = x2 - x1;
    let dy = y2 - y1;

    if (Math.abs(dx) > 0.5 * rangeX) {
        if (Math.sign(dx) == -1) {
            dx = rangeX + dx;
        } else {
            dx = -rangeX + dx;
        }
    }

    if (Math.abs(dy) > 0.5 * rangeY) {
        if (Math.sign(dy) == -1) {
            dy = rangeY + dy;
        } else {
            dy = -rangeY + dy;
        }
    }

    return [dx, dy];
}

function dist2(vec1: Coordinate, vec2: Coordinate) {
    const [dx, dy] = vecSub2(vec1, vec2);
    return Math.sqrt(dx ** 2 + dy ** 2);
}

function dist2Torus(
    [rangeX, rangeY]: [number, number],
    vec1: Coordinate,
    vec2: Coordinate
) {
    const [dx, dy] = vecSub2Torus([rangeX, rangeY], vec1, vec2);
    return Math.sqrt(dx ** 2 + dy ** 2);
}

function moveEnemies(enemies: Enemies, players: Players) {
    for (const enemy of enemies) {
        const playersSorted = [...players].sort((player1, player2) => {
            return (
                dist2Torus(
                    [gameParams.columns, gameParams.rows],
                    [enemy.x, enemy.y],
                    [player1.x, player1.y]
                ) -
                dist2Torus(
                    [gameParams.columns, gameParams.rows],
                    [enemy.x, enemy.y],
                    [player2.x, player2.y]
                )
            );
        });

        const nearestPlayer = playersSorted[0];
        const diffVec = vecSub2Torus(
            [gameParams.columns, gameParams.rows],
            [enemy.x, enemy.y],
            [nearestPlayer.x, nearestPlayer.y]
        );

        // console.log(diffVec, '@: ', enemy.x, enemy.y)

        const diffX = diffVec[0];
        const diffY = diffVec[1];

        if (diffX == 0 && diffY == 0) {
            continue;
        } else if (Math.abs(diffY) >= Math.abs(diffX)) {
            applyEntityColor(enemyColor, [enemy]);
            enemy.y = mod(
                enemy.y + Math.sign(diffY) * 1 * Math.round(Math.random()),
                gameParams.rows
            );
            applyEntityColor(enemyColor, [enemy]);
        } else {
            applyEntityColor(enemyColor, [enemy]);
            enemy.x = mod(
                enemy.x + Math.sign(diffX) * 1 * Math.round(Math.random()),
                gameParams.columns
            );
            applyEntityColor(enemyColor, [enemy]);
        }
    }
}

initGame();

// put inside game loop
let gameOver = false;
let gameStarted = false;

function updateGameState() {
    movePlayers(gameState.players);
    moveEnemies(gameState.enemies, gameState.players);
}

function gameLoop() {
    if (!gameOver) {
        if (gameStarted) updateGameState();
        setTimeout(() => {
            window.requestAnimationFrame(gameLoop);
        }, gameParams.delay);
    }
}

gameLoop();

// convert from arrays to single object where keys are coordinates and values are entities
// don't have entity.x and entity.y, instead make an entity.position
// make end game
// make re-init
// make variables editable on page

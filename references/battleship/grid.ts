type PossibleValue = "" | ShipType | "hit" | "miss";
type Position = `${string}-${number}`;
type GridState = Record<Position, PossibleValue>;

abstract class Grid {
  protected state: GridState;
  protected type: "player" | "computer";
  ships: Ship[] = [];
  element: HTMLElement;
  squares: HTMLElement[] = [];

  constructor(type: "player" | "computer") {
    this.type = type;
    this.state = {};
    for (let i = 0; i < gridChars.length; i++) {
      for (let j = 1; j <= 10; j++) {
        const position: Position = `${gridChars[i]}-${j}`;
        this.state[position] = "";
      }
    }
    this.element = document.createElement("div");
    this.element.classList.add(
      "battleship-grid",
      this.type === "player" ? "grid-player" : "grid-computer"
    );
  }

  static makePositionFromId(id: string): Position {
    const [char, number] = id.split("-").slice(1);
    return `${char}-${parseInt(number)}`;
  }

  static makeCoordinateFromPosition(position: Position): [string, number] {
    const positionArray = position.split("-");
    return [positionArray[0], parseInt(positionArray[1])];
  }

  get(position: Position): PossibleValue {
    return this.state[position];
  }

  set(position: Position, value: PossibleValue): void {
    this.state[position] = value;
  }

  has(position: Position): boolean {
    return !!this.state[position];
  }

  createBoard(): void {
    for (const key in this.state) {
      const square = document.createElement("div");
      square.setAttribute("id", `${this.type}-${key}`);
      this.element.appendChild(square);
      this.squares.push(square);
    }
    const container = document.getElementById("container");
    container?.appendChild(this.element);
  }

  removeShip(ship: Ship) {
    this.ships = this.ships.filter((s) => s !== ship);
  }

  protected calculateOffset<T>(ship: Ship, array: T[], element: T) {
    let offset = 0;
    const index = array.indexOf(element);
    if (index + ship.length > array.length) {
      offset = index + ship.length - array.length;
    }
    return offset;
  }

  protected isTaken(shipSquares: Position[]): boolean {
    return shipSquares.some((square) => this.get(square));
  }

  protected drawShip(positions: Position[], shipType: ShipType): void {
    positions.forEach((position) => {
      const square = document.getElementById(`${this.type}-${position}`);
      square?.classList.add("taken", shipType);
    });
  }

  takeShot(square: Element): void {
    const info = document.getElementById("info") as Element;
    const currentPlayer = this.type === "computer" ? "You" : "CPU";
    const position = Grid.makePositionFromId(square.id);
    const squareValue = this.get(position);

    if (shipNames.includes(squareValue as ShipType)) {
      const hitShip = this.ships.find(
        (ship) => ship.type === squareValue
      ) as Ship;
      hitShip.hit();
      square.classList.add("boom");
      this.set(position, "hit");
      info.innerHTML = `${currentPlayer} hit`;
      if (hitShip.sunken) {
        info.innerHTML = `${
          this.type === "computer" ? "CPU" : "Your"
        } ${hitShip.type.toUpperCase()} sunken`;
        this.removeShip(hitShip);
        if (!this.ships.length) {
          info.innerHTML = "Game Over";
          return;
        }
      }
    } else if (!squareValue) {
      square.classList.add("miss");
      this.set(position, "miss");
      info.innerHTML = `${currentPlayer} missed`;
    }
  }
}

class PlayerGrid extends Grid {
  shipsToBePlaced: PlayerShip[] = [];
  ships: PlayerShip[] = [];
  selectedShip: PlayerShip | null = null;
  selectedShipPart: number = 0;

  constructor() {
    super("player");

    shipNames.forEach((shipName) =>
      this.shipsToBePlaced.push(new PlayerShip(shipName))
    );
  }

  addListeners(): void {
    this.shipsToBePlaced.forEach((ship) => {
      ship.element.addEventListener("mousedown", (e) => {
        const target = getElementFromEvent(e);
        this.selectedShipPart = parseInt(
          target.id.substring(target.id.length - 1)
        );
      });
      ship.element.addEventListener(
        "dragstart",
        () => (this.selectedShip = ship)
      );
    });

    this.element.addEventListener("dragstart", (e) => e.preventDefault());
    this.element.addEventListener("dragover", (e) => e.preventDefault());
    this.element.addEventListener("dragenter", (e) => e.preventDefault());
    this.element.addEventListener("dragleave", (e) => e.preventDefault());
    this.element.addEventListener("drop", (e) => {
      const target = getElementFromEvent(e);
      const position = Grid.makePositionFromId(target.id);

      if (this.selectedShip)
        this.placeShip(this.selectedShip, this.selectedShipPart, position);
    });
    this.element.addEventListener("dragend", (e) => e.preventDefault());
  }

  placeShip(ship: PlayerShip, shipPart: number, position: Position): void {
    const shipSquares: Position[] = [];
    const [charPosition, numberPoistion] =
      Grid.makeCoordinateFromPosition(position);
    const charPostion = gridChars.indexOf(position[0]);

    if (ship.direction === "horizontal") {
      for (let i = 0; i < ship.length; i++) {
        const number = numberPoistion + i - shipPart;
        if (number > 10 || number <= 0) {
          return;
        }
        shipSquares.push(`${charPosition}-${number}`);
      }
    } else {
      for (let i = 0; i < ship.length; i++) {
        const char = gridChars[charPostion + i - shipPart];
        if (!char) {
          return;
        }
        shipSquares.push(`${char}-${numberPoistion}`);
      }
    }

    const isTaken = this.isTaken(shipSquares);

    if (!isTaken) {
      shipSquares.forEach((square) => this.set(square, ship.type));
      this.drawShip(shipSquares, ship.type);
      document.querySelector(`.${ship.type}-container`)?.remove();
      this.shipsToBePlaced = this.shipsToBePlaced.filter((s) => s !== ship);
      this.ships.push(ship);
    }
  }

  randomHit(): Element {
    let sqaureValue: PossibleValue;
    let randomPosition = getRandomPosition(this.state);
    sqaureValue = this.get(randomPosition);
    while (sqaureValue === "hit" || sqaureValue === "miss") {
      randomPosition = getRandomPosition(this.state);
      sqaureValue = this.get(randomPosition);
    }
    return document.getElementById(`player-${randomPosition}`) as Element;
  }
}

class ComputerGrid extends Grid {
  constructor() {
    super("computer");

    shipNames.forEach((shipName) => this.ships.push(new Ship(shipName)));
  }

  private makeRandomPosition(ship: Ship): Position[] {
    const shipSquares: Position[] = [];
    let [randomChar, randomNumber] = Grid.makeCoordinateFromPosition(
      getRandomPosition(this.state)
    );

    const charPostion = gridChars.indexOf(randomChar);
    const directions: Direction[] = ["horizontal", "vertical"];
    ship.direction = randomElementFromArray(directions);

    if (ship.direction === "horizontal") {
      const horizontalOffset = this.calculateOffset(
        ship,
        gridNumbers,
        randomNumber
      );
      for (let i = 0; i < ship.length; i++) {
        const number = randomNumber + i - horizontalOffset;
        shipSquares.push(`${randomChar}-${number}`);
      }
    } else {
      const verticalOffset = this.calculateOffset(ship, gridChars, randomChar);
      for (let i = 0; i < ship.length; i++) {
        const char = gridChars[charPostion + i - verticalOffset];
        shipSquares.push(`${char}-${randomNumber}`);
      }
    }

    return shipSquares;
  }

  generateShipPlacement(ship: Ship): void {
    let shipSquares = this.makeRandomPosition(ship);
    let isTaken = this.isTaken(shipSquares);

    while (isTaken) {
      shipSquares = this.makeRandomPosition(ship);
      isTaken = this.isTaken(shipSquares);
    }

    shipSquares.forEach((square) => this.set(square, ship.type));

    this.drawShip(shipSquares, ship.type);
  }
}

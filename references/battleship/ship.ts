type ShipType =
  | "destroyer"
  | "submarine"
  | "cruiser"
  | "battleship"
  | "carrier";

type Direction = "vertical" | "horizontal";

class Ship {
  type: ShipType;
  length: number;
  hits: number = 0;
  direction: "horizontal" | "vertical" = "horizontal";

  constructor(type: ShipType) {
    this.type = type;
    switch (this.type) {
      case "destroyer":
        this.length = 2;
        break;
      case "cruiser":
      case "submarine":
        this.length = 3;
        break;
      case "battleship":
        this.length = 4;
        break;
      case "carrier":
        this.length = 5;
        break;
    }
  }

  hit(): void {
    if (this.hits < this.length) {
      this.hits += 1;
    }
  }

  get sunken(): boolean {
    return this.hits === this.length;
  }
}

class PlayerShip extends Ship {
  element: Element;
  constructor(type: ShipType) {
    super(type);
    this.element = document.querySelector(`.${this.type}-container`) as Element;
  }

  rotateShip() {
    if (this.direction === "vertical") {
      this.direction = "horizontal";
    } else {
      this.direction = "vertical";
    }
    const shipSpecificClassName = this.element.className.split(" ")[1];
    this.element.classList.toggle(`${shipSpecificClassName}-vertical`);
  }
}

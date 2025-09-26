document.addEventListener("DOMContentLoaded", () => {
  const rotateButton = document.getElementById("rotate") as Element;
  const startButton = document.getElementById("start") as Element;
  const info = document.getElementById("info") as Element;

  const playerGrid = new PlayerGrid();
  const computerGrid = new ComputerGrid();
  playerGrid.createBoard();
  computerGrid.createBoard();

  computerGrid.ships.forEach((ship) =>
    computerGrid.generateShipPlacement(ship)
  );

  rotateButton.addEventListener("click", () =>
    playerGrid.shipsToBePlaced.forEach((ship) => ship.rotateShip())
  );

  playerGrid.addListeners();

  function fire(e: Event) {
    const square = getElementFromEvent(e);
    const isSquare = square.matches(".grid-computer > div");
    const position = Grid.makePositionFromId(square.id);
    const squareValue = computerGrid.get(position);

    if (!isSquare) {
      return;
    }

    if (squareValue === "hit" || squareValue === "miss") {
      info.innerHTML = "Select another square";
      return;
    }

    if (!playerGrid.ships.length || !computerGrid.ships.length) {
      return;
    }
    computerGrid.takeShot(square);

    if (playerGrid.ships.length && computerGrid.ships.length) {
      const firedSquare = playerGrid.randomHit();
      playerGrid.takeShot(firedSquare);
    }
  }

  startButton.addEventListener("click", () => {
    if (playerGrid.shipsToBePlaced.length > 0) {
      info.innerHTML = "Please place all of your ships";
      return;
    }

    info.innerHTML = "Game started";

    computerGrid.element.addEventListener("click", fire);
  });
});

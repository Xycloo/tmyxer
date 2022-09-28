import init, { Universe, Cell } from "./pkg/wasm_game_of_life.js";
//import { memory } from "wasm-game-of-life/wasm_game_of_life_bg";

let memory;
async function run_wasm() {
    let wasmm = await init();
    let memory = wasmm.memory;
    const CELL_SIZE = 10; // px
    const GRID_COLOR = "#000000";
    const DEAD_COLOR = "#ededed";
    const ALIVE_COLOR = "#fe0ce9";

    // Construct the universe, and get its width and height.
    const universe = Universe.new();
    const width = universe.width();
    const height = universe.height();
    
    // Give the canvas room for all of our cells and a 1px border
    // around each of them.
    const canvas = document.getElementById("game-of-life-canvas");
    canvas.height = (CELL_SIZE + 1) * height + 1;
    canvas.width = (CELL_SIZE + 1) * width + 1;

    const ctx = canvas.getContext('2d');

    const fps = new class {
	constructor() {

	    this.frames = [];
	    this.lastFrameTimeStamp = performance.now();
	}

	render() {
	    // Convert the delta time since the last frame render into a measure
	    // of frames per second.
	    const now = performance.now();
	    const delta = now - this.lastFrameTimeStamp;
	    this.lastFrameTimeStamp = now;
	    const fps = 1 / delta * 100;

	    // Save only the latest 100 timings.
	    this.frames.push(fps);
	    if (this.frames.length > 100) {
		this.frames.shift();
	    }

	    // Find the max, min, and mean of our 100 latest timings.
	    let min = Infinity;
	    let max = -Infinity;
	    let sum = 0;
	    for (let i = 0; i < this.frames.length; i++) {
		sum += this.frames[i];
		min = Math.min(this.frames[i], min);
		max = Math.max(this.frames[i], max);
	    }
	    let mean = sum / this.frames.length;
	}
    };

    let animationId = null;
    
    canvas.addEventListener("click", event => {
	const boundingRect = canvas.getBoundingClientRect();

	const scaleX = canvas.width / boundingRect.width;
	const scaleY = canvas.height / boundingRect.height;

	const canvasLeft = (event.clientX - boundingRect.left) * scaleX;
	const canvasTop = (event.clientY - boundingRect.top) * scaleY;

	const row = Math.min(Math.floor(canvasTop / (CELL_SIZE + 1)), height - 1);
	const col = Math.min(Math.floor(canvasLeft / (CELL_SIZE + 1)), width - 1);

	universe.toggle_cell(row, col);

	drawCells();
	drawGrid();
    });
    
    const renderLoop = () => {
	fps.render();

	drawGrid();
	drawCells();


	universe.tick();
	setTimeout(() => {
	    animationId = requestAnimationFrame(renderLoop);
	}, 100);

    };

    const play = () => {

	renderLoop();
    };




    const drawGrid = () => {
	ctx.beginPath();
	ctx.strokeStyle = GRID_COLOR;
	canvas.style.zIndex = -99;
	// Vertical lines.
	for (let i = 0; i <= width; i++) {
	    ctx.moveTo(i * (CELL_SIZE + 1) + 1, 0);
	    ctx.lineTo(i * (CELL_SIZE + 1) + 1, (CELL_SIZE + 1) * height + 1);
	}

	// Horizontal lines.
	for (let j = 0; j <= height; j++) {
	    ctx.moveTo(0,                           j * (CELL_SIZE + 1) + 1);
	    ctx.lineTo((CELL_SIZE + 1) * width + 1, j * (CELL_SIZE + 1) + 1);
	}

	ctx.stroke();
    };

    const getIndex = (row, column) => {
	return row * width + column;
    };

    const drawCells = () => {
	const cellsPtr = universe.cells();
	const cells = new Uint8Array(memory.buffer, cellsPtr, width * height);

	ctx.beginPath();

	// Alive cells.
	ctx.fillStyle = ALIVE_COLOR;
	for (let row = 0; row < height; row++) {
	    for (let col = 0; col < width; col++) {
		const idx = getIndex(row, col);
		if (cells[idx] !== Cell.Alive) {
		    continue;
		}

		ctx.fillRect(
		    col * (CELL_SIZE + 1) + 1,
		    row * (CELL_SIZE + 1) + 1,
		    CELL_SIZE,
		    CELL_SIZE
		);
	    }
	}

	// Dead cells.
	ctx.fillStyle = DEAD_COLOR;
	for (let row = 0; row < height; row++) {
	    for (let col = 0; col < width; col++) {
		const idx = getIndex(row, col);
		if (cells[idx] !== Cell.Dead) {
		    continue;
		}

		ctx.fillRect(
		    col * (CELL_SIZE + 1) + 1,
		    row * (CELL_SIZE + 1) + 1,
		    CELL_SIZE,
		    CELL_SIZE
		);
	    }
	}

	ctx.stroke();
    };

    console.log("inited")
    play();
}

run_wasm();

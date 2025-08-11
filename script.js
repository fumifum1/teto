document.addEventListener('DOMContentLoaded', () => {
    const gameContainer = document.getElementById('game-container');
    const gameCanvas = document.getElementById('game-canvas');
    const gameCtx = gameCanvas.getContext('2d');
    const nextCanvas = document.getElementById('next-block-canvas');
    const nextCtx = nextCanvas.getContext('2d');
    const scoreElement = document.getElementById('score');
    const levelElement = document.getElementById('level');
    const startScreen = document.getElementById('start-screen');
    const startButton = document.getElementById('start-button');
    // --- ゲーム設定 ---
    const COLS = 10;
    const ROWS = 20;
    let TILE_SIZE;
    const COLORS = [
        '#000', // 空タイル
        'cyan', '#00f', 'orange', 'yellow', 'lime', 'purple', 'red' // ブロックの色
    ];
    let score = 0;
    let level = 1;
    let fallSpeed = 1000;
    let lastTime = 0;
    let fallTime = 0;
    let playfield = [];
    let currentBlock, nextBlock;
    let isGameOver = false;
    let isGamePaused = true; // 最初にゲームを一時停止

    // --- ブロックの定義 ---
    const TETROMINOS = [
        [[1, 1, 1, 1]], // I
        [[1, 0, 0], [1, 1, 1]], // J
        [[0, 0, 1], [1, 1, 1]], // L
        [[1, 1], [1, 1]], // O
        [[0, 1, 1], [1, 1, 0]], // S
        [[0, 1, 0], [1, 1, 1]], // T
        [[1, 1, 0], [0, 1, 1]] // Z
    ];

    // --- 初期化 ---
    function init() {
        setVhVariable();
        resizeCanvas();
        resetGame();
        // 最初のゲームループはスタートボタンが押されてから開始
        // gameLoop();
    }

    // モバイルブラウザの100vh問題を解決するための関数
    function setVhVariable() {
        let vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty('--vh', `${vh}px`);
    }

    function resizeCanvas() {
        const infoPanel = document.getElementById('info-panel');
    
        const containerHeight = gameContainer.clientHeight - infoPanel.clientHeight;
        const containerWidth = gameContainer.clientWidth;

        TILE_SIZE = Math.floor(Math.min(containerWidth / COLS, containerHeight / ROWS));

        gameCanvas.width = COLS * TILE_SIZE;
        gameCanvas.height = ROWS * TILE_SIZE;
        // 見切れ対策: canvasのCSSサイズをJSで設定
        gameCanvas.style.width = `${gameCanvas.width}px`;
        gameCanvas.style.height = `${gameCanvas.height}px`;

        // NEXTブロック用のサイズ設定
        const nextTileSize = Math.floor(TILE_SIZE * 0.6);
        nextCanvas.width = nextTileSize * 4;
        nextCanvas.height = nextTileSize * 4;

        render();
        renderNextBlock(); // リサイズ時にNEXTブロックも再描画
    }

    function resetGame() {
        score = 0;
        level = 1;
        fallSpeed = 1000;
        isGameOver = false;
        scoreElement.textContent = score;
        levelElement.textContent = level;
        playfield = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        currentBlock = getRandomBlock();
        nextBlock = getRandomBlock();
        renderNextBlock();
    }

    // --- ゲームループ ---
    function gameLoop(timestamp = 0) {
        if (isGameOver || isGamePaused) return;

        const deltaTime = timestamp - lastTime;
        lastTime = timestamp;
        fallTime += deltaTime;

        if (fallTime >= fallSpeed) {
            moveBlock(0, 1);
            fallTime = 0;
        }

        render();
        requestAnimationFrame(gameLoop);
    }

    // --- 描画処理 ---
    function render() {
        gameCtx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);
        drawPlayfield();
        drawGhostBlock();
        drawBlock(currentBlock, gameCtx);
    }

    function drawPlayfield() {
        for (let row = 0; row < ROWS; row++) {
            if (playfield[row]) {
                for (let col = 0; col < COLS; col++) {
                    if (playfield[row][col]) {
                        drawTile(col, row, playfield[row][col], gameCtx, TILE_SIZE);
                    }
                }
            }
        }
    }

    function drawBlock(block, ctx, offsetX = 0, offsetY = 0, tileSize = TILE_SIZE) {
        if (!block) return;
        block.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    if (block.y + y + offsetY >= 0) {
                        drawTile(block.x + x + offsetX, block.y + y + offsetY, block.type, ctx, tileSize);
                    }
                }
            });
        });
    }

    function drawTile(x, y, type, ctx, tileSize) {
        ctx.fillStyle = COLORS[type];
        ctx.fillRect(x * tileSize, y * tileSize, tileSize, tileSize);
        ctx.strokeStyle = '#222';
        ctx.strokeRect(x * tileSize, y * tileSize, tileSize, tileSize);
    }

    function renderNextBlock() {
        nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
        if (!nextBlock) return;
        const blockType = TETROMINOS.findIndex(
            (matrix) => JSON.stringify(matrix) === JSON.stringify(nextBlock.matrix)
        ) + 1;

        const blockWidth = nextBlock.matrix[0].length;
        const blockHeight = nextBlock.matrix.length;
        const offsetX = (4 - blockWidth) / 2;
        const offsetY = (4 - blockHeight) / 2;

        // nextCanvasの幅からタイルサイズを計算
        const nextTileSize = nextCanvas.width / 4;

        drawBlock({ ...nextBlock, type: blockType, x: 0, y: 0 }, nextCtx, offsetX, offsetY, nextTileSize);
    }

    // --- ゴーストブロックの描画 ---
    function drawGhostBlock() {
        const ghostBlock = getGhostBlock();
        if (!ghostBlock) return;

        gameCtx.globalAlpha = 0.3;
        drawBlock(ghostBlock, gameCtx);
        gameCtx.globalAlpha = 1.0;
    }
    
    // --- ゴーストブロックの計算 ---
    function getGhostBlock() {
        if (!currentBlock) return null;
        
        const ghostBlock = {
            ...currentBlock,
            y: currentBlock.y
        };
        
        while (!checkGhostCollision(ghostBlock, 0, 1)) {
            ghostBlock.y++;
        }
        
        return ghostBlock;
    }

    // --- ゴーストブロック専用の衝突判定 ---
    function checkGhostCollision(block, dx, dy) {
        return block.matrix.some((row, y) => {
            return row.some((value, x) => {
                if (value === 0) return false;
                const newX = block.x + x + dx;
                const newY = block.y + y + dy;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY < 0) {
                    return false;
                }
                
                if (playfield[newY] && playfield[newY][newX] !== 0) {
                    return true;
                }
                
                return false;
            });
        });
    }

    // --- ゲームロジック ---
    function getRandomBlock() {
        const typeIndex = Math.floor(Math.random() * TETROMINOS.length);
        const matrix = TETROMINOS[typeIndex];
        return {
            type: typeIndex + 1,
            matrix: JSON.parse(JSON.stringify(matrix)),
            x: Math.floor(COLS / 2) - Math.floor(matrix[0].length / 2),
            y: 0
        };
    }

    function rotateBlock() {
        if (isGamePaused) return;

        const matrix = currentBlock.matrix;
        const newMatrix = matrix[0].map((_, colIndex) => matrix.map(row => row[colIndex]).reverse());

        const oldMatrix = currentBlock.matrix;
        currentBlock.matrix = newMatrix;

        if (checkCollision()) {
            currentBlock.matrix = oldMatrix;
        }
    }

    function moveBlock(dx, dy) {
        if (isGamePaused) return;

        currentBlock.x += dx;
        currentBlock.y += dy;
        if (checkCollision()) {
            currentBlock.x -= dx;
            currentBlock.y -= dy;
            if (dy > 0) {
                lockBlock();
            }
            return false;
        }
        return true;
    }

    function checkCollision() {
        return currentBlock.matrix.some((row, y) => {
            return row.some((value, x) => {
                if (value === 0) return false;
                const newX = currentBlock.x + x;
                const newY = currentBlock.y + y;
                
                if (newX < 0 || newX >= COLS || newY >= ROWS) {
                    return true;
                }
                
                if (newY < 0) {
                    return false;
                }
                
                if (playfield[newY] && playfield[newY][newX] !== 0) {
                    return true;
                }
                
                return false;
            });
        });
    }

    function lockBlock() {
        currentBlock.matrix.forEach((row, y) => {
            row.forEach((value, x) => {
                if (value) {
                    const newY = currentBlock.y + y;
                    const newX = currentBlock.x + x;
                    if (newY >= 0) {
                        playfield[newY][newX] = currentBlock.type;
                    }
                }
            });
        });

        clearLines();

        currentBlock = nextBlock;
        nextBlock = getRandomBlock();
        renderNextBlock();

        if (checkCollision()) {
            isGameOver = true;
            alert('ゲームオーバー！ スコア: ' + score);
        }
    }

    function clearLines() {
        let linesCleared = 0;
        for (let row = ROWS - 1; row >= 0; row--) {
            if (playfield[row].every(cell => cell !== 0)) {
                playfield.splice(row, 1);
                playfield.unshift(Array(COLS).fill(0));
                linesCleared++;
                row++;
            }
        }
        if (linesCleared > 0) {
            updateScore(linesCleared);
        }
    }

    function updateScore(linesCleared) {
        const points = [0, 40, 100, 300, 1200];
        score += points[linesCleared] * level;
        scoreElement.textContent = score;

        const newLevel = Math.floor(score / 1000) + 1;
        if (newLevel > level) {
            level = newLevel;
            fallSpeed = Math.max(100, fallSpeed - 50);
            levelElement.textContent = level;
        }
    }

    // --- タッチ・フリック操作 ---
    let touchStartX = 0;
    let touchStartY = 0;
    let touchMoved = false;

    gameCanvas.addEventListener('touchstart', (e) => {
        if (isGamePaused) return;

        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchMoved = false;
        e.preventDefault();
    }, { passive: false });

    gameCanvas.addEventListener('touchmove', (e) => {
        if (isGamePaused) return;
        
        touchMoved = true;
        e.preventDefault();
    }, { passive: false });

    gameCanvas.addEventListener('touchend', (e) => {
        if (isGamePaused) return;

        const touchEndX = e.changedTouches[0].clientX;
        const touchEndY = e.changedTouches[0].clientY;

        const dx = touchEndX - touchStartX;
        const dy = touchEndY - touchStartY;

        const swipeThreshold = 30;
        const hardDropThreshold = 100;

        if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > swipeThreshold) {
            moveBlock(dx > 0 ? 1 : -1, 0);
        } else if (Math.abs(dy) > Math.abs(dx) && dy > swipeThreshold) {
            if (dy > hardDropThreshold) {
                while (moveBlock(0, 1));
            } else {
                moveBlock(0, 1);
            }
        } else if (!touchMoved) {
            rotateBlock();
        }
    });

    // --- キーボード操作（デバッグ用） ---
    document.addEventListener('keydown', (e) => {
        if (isGameOver || isGamePaused) return;

        if (e.key === 'ArrowLeft') moveBlock(-1, 0);
        if (e.key === 'ArrowRight') moveBlock(1, 0);
        if (e.key === 'ArrowDown') moveBlock(0, 1);
        if (e.key === 'ArrowUp') rotateBlock();
        if (e.key === ' ') while (moveBlock(0, 1));
    });

    // --- スタートボタンのイベントリスナー ---
    startButton.addEventListener('click', () => {
        startScreen.style.display = 'none';
        isGamePaused = false;
        gameLoop();
    });

    // --- イベントリスナー ---
    window.addEventListener('resize', () => {
        setVhVariable();
        resizeCanvas();
    });

    // --- 最初の初期化は必ず実行 ---
    init();
});
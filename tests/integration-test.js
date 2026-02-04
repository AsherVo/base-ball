/**
 * Integration Test Suite for Base Ball C# Server
 * Phase 11: Tests all major game mechanics
 *
 * Run with: node tests/integration-test.js
 * Requires: npm install @microsoft/signalr
 */

const signalR = require('@microsoft/signalr');

const SERVER_URL = 'http://localhost:3000/game';

// Test results
const results = {
    passed: 0,
    failed: 0,
    tests: []
};

function log(msg) {
    console.log(`[${new Date().toISOString().split('T')[1].slice(0, 8)}] ${msg}`);
}

function pass(name) {
    results.passed++;
    results.tests.push({ name, status: 'PASS' });
    log(`✓ ${name}`);
}

function fail(name, error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error?.message || error });
    log(`✗ ${name}: ${error?.message || error}`);
}

async function createConnection() {
    const connection = new signalR.HubConnectionBuilder()
        .withUrl(SERVER_URL)
        .configureLogging(signalR.LogLevel.Error)
        .build();

    await connection.start();
    return connection;
}

function waitForEvent(connection, eventName, timeout = 5000) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            connection.off(eventName, handler);
            reject(new Error(`Timeout waiting for ${eventName}`));
        }, timeout);

        const handler = (data) => {
            clearTimeout(timer);
            connection.off(eventName, handler);
            resolve(data);
        };

        connection.on(eventName, handler);
    });
}

// ===== TEST CASES =====

async function testConnection() {
    const connection = await createConnection();
    if (connection.state === signalR.HubConnectionState.Connected) {
        pass('Connection established');
    } else {
        fail('Connection established', 'Not connected');
    }
    await connection.stop();
}

async function testSetName() {
    const connection = await createConnection();
    try {
        await connection.invoke('SetName', 'TestPlayer');
        pass('SetName invoked successfully');
    } catch (e) {
        fail('SetName', e);
    }
    await connection.stop();
}

async function testCreateRoom() {
    const connection = await createConnection();
    try {
        const roomPromise = waitForEvent(connection, 'roomCreated');
        await connection.invoke('CreateRoom');
        const data = await roomPromise;

        if (data.roomId && data.roomId.length === 6) {
            pass('CreateRoom returns valid room ID');
        } else {
            fail('CreateRoom returns valid room ID', `Invalid roomId: ${data.roomId}`);
        }
    } catch (e) {
        fail('CreateRoom', e);
    }
    await connection.stop();
}

async function testJoinRoom() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Player 1 creates room
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        // Player 2 joins room
        const joinPromise = waitForEvent(conn2, 'roomJoined');
        await conn2.invoke('JoinRoom', roomData.roomId);
        const joinData = await joinPromise;

        if (joinData.roomId === roomData.roomId && joinData.playerCount === 2) {
            pass('JoinRoom - second player joins successfully');
        } else {
            fail('JoinRoom', `Room mismatch or wrong player count: ${JSON.stringify(joinData)}`);
        }
    } catch (e) {
        fail('JoinRoom', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testMatchReady() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        await conn1.invoke('SetName', 'Player1');
        await conn2.invoke('SetName', 'Player2');

        // Player 1 creates room
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        // Set up matchReady listener BEFORE player 2 joins
        const matchReadyPromise = waitForEvent(conn1, 'matchReady');

        // Player 2 joins room
        await conn2.invoke('JoinRoom', roomData.roomId);
        const matchReady = await matchReadyPromise;

        if (matchReady.players && matchReady.players.length === 2) {
            pass('MatchReady triggered when room is full');
        } else {
            fail('MatchReady', `Expected 2 players, got: ${JSON.stringify(matchReady)}`);
        }
    } catch (e) {
        fail('MatchReady', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testReadyAndCountdown() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup room
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        // Set up listener for matchReady before join
        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        // Set up countdown listener before readying
        const countdownPromise = waitForEvent(conn1, 'countdown', 10000);

        // Both players ready up
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');

        const countdown = await countdownPromise;
        if (countdown.count && countdown.count > 0) {
            pass('Countdown starts when both players ready');
        } else {
            fail('Countdown', `Invalid countdown: ${JSON.stringify(countdown)}`);
        }
    } catch (e) {
        fail('Countdown', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testGameStart() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup room
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        // Listen for gameStart before readying
        const gameStartPromise = waitForEvent(conn1, 'gameStart', 10000);

        // Both ready
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');

        const gameStart = await gameStartPromise;

        if (gameStart.world && gameStart.world.actors && gameStart.playerId) {
            pass('GameStart received with world state');

            // Verify world structure
            const world = gameStart.world;
            if (world.width === 100 && world.height === 60) {
                pass('World dimensions correct (100x60)');
            } else {
                fail('World dimensions', `Got ${world.width}x${world.height}`);
            }

            // Check for key entities
            const actors = world.actors;
            const bases = actors.filter(a => a.subtype === 'base');
            const workers = actors.filter(a => a.subtype === 'worker');
            const ball = actors.find(a => a.type === 'ball');
            const avatars = actors.filter(a => a.type === 'avatar');
            const minerals = actors.filter(a => a.type === 'resource');

            if (bases.length === 2) {
                pass('Two bases created');
            } else {
                fail('Two bases', `Found ${bases.length} bases`);
            }

            if (workers.length === 8) {
                pass('Eight workers created (4 per player)');
            } else {
                fail('Eight workers', `Found ${workers.length} workers`);
            }

            if (ball) {
                pass('Ball created');
            } else {
                fail('Ball created', 'No ball found');
            }

            if (avatars.length === 2) {
                pass('Two avatars created');
            } else {
                fail('Two avatars', `Found ${avatars.length} avatars`);
            }

            if (minerals.length >= 4) {
                pass('Mineral patches created');
            } else {
                fail('Mineral patches', `Found ${minerals.length} minerals`);
            }
        } else {
            fail('GameStart', `Invalid data: ${JSON.stringify(gameStart).slice(0, 200)}`);
        }
    } catch (e) {
        fail('GameStart', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testGameStateUpdates() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup and start game
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        const gameStartPromise = waitForEvent(conn1, 'gameStart', 10000);
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');
        await gameStartPromise;

        // Wait for game state updates
        let stateCount = 0;
        const startTime = Date.now();

        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (stateCount >= 3) {
                    resolve();
                } else {
                    reject(new Error(`Only received ${stateCount} state updates`));
                }
            }, 3000);

            conn1.on('gameState', () => {
                stateCount++;
                if (stateCount >= 3) {
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        const elapsed = Date.now() - startTime;
        const rate = (stateCount / elapsed * 1000).toFixed(1);

        pass(`GameState updates received (${stateCount} in ${elapsed}ms, ~${rate}/sec)`);
    } catch (e) {
        fail('GameState updates', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testAvatarMovement() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup and start game
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        const gameStartPromise = waitForEvent(conn1, 'gameStart', 10000);
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');

        const gameStart = await gameStartPromise;
        const avatar = gameStart.world.actors.find(a =>
            a.type === 'avatar' && a.ownerId === gameStart.playerId
        );

        if (!avatar) {
            fail('Avatar movement', 'Could not find player avatar');
            await conn1.stop();
            await conn2.stop();
            return;
        }

        const initialX = avatar.x;

        // Send movement command (move right)
        await conn1.invoke('PlayerCommand', {
            type: 'AVATAR_MOVE',
            directionX: 1,
            directionY: 0
        });

        // Wait for a few updates and check position changed
        let movedAvatar = null;
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout')), 2000);
            let checks = 0;

            conn1.on('gameState', (data) => {
                checks++;
                const a = data.world.actors.find(ac => ac.id === avatar.id);
                if (a && a.x !== initialX) {
                    movedAvatar = a;
                    clearTimeout(timeout);
                    resolve();
                }
                if (checks > 40) {
                    clearTimeout(timeout);
                    reject(new Error('Avatar did not move after 40 ticks'));
                }
            });
        });

        if (movedAvatar && movedAvatar.x > initialX) {
            pass(`Avatar movement works (moved from ${initialX.toFixed(0)} to ${movedAvatar.x.toFixed(0)})`);
        } else {
            fail('Avatar movement', `Avatar position unchanged or moved wrong direction`);
        }
    } catch (e) {
        fail('Avatar movement', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testPlayVsAI() {
    const conn = await createConnection();

    try {
        await conn.invoke('SetName', 'TestPlayer');

        // Create room with AI
        const roomPromise = waitForEvent(conn, 'roomCreated');
        const matchReadyPromise = waitForEvent(conn, 'matchReady');
        await conn.invoke('CreateRoomWithAI', { aiType: 'normal' });

        const room = await roomPromise;
        if (!room.roomId) {
            fail('Create AI room', 'No room ID');
            await conn.stop();
            return;
        }

        const matchReady = await matchReadyPromise;
        if (matchReady.players && matchReady.players.length === 2) {
            pass('AI room created with 2 players');
        } else {
            fail('AI room', `Expected 2 players, got ${matchReady.players?.length}`);
        }

        // Ready up and start game
        const gameStartPromise = waitForEvent(conn, 'gameStart', 10000);
        await conn.invoke('PlayerReady');
        const gameStart = await gameStartPromise;

        if (gameStart.world && gameStart.world.actors) {
            pass('AI game started successfully');
        } else {
            fail('AI game start', 'Invalid game start data');
        }
    } catch (e) {
        fail('Play vs AI', e);
    }

    await conn.stop();
}

async function testQuickMatch() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        await conn1.invoke('SetName', 'Quick1');
        await conn2.invoke('SetName', 'Quick2');

        // First player enters quick match
        const waiting1 = waitForEvent(conn1, 'waitingForMatch');
        await conn1.invoke('QuickMatch');
        await waiting1;
        pass('Player 1 entered quick match queue');

        // Set up match ready listeners before second player joins
        const matchReady1 = waitForEvent(conn1, 'matchReady', 5000);
        const matchReady2 = waitForEvent(conn2, 'matchReady', 5000);

        // Second player joins queue - should match with first
        await conn2.invoke('QuickMatch');

        const match1 = await matchReady1;
        const match2 = await matchReady2;

        if (match1.roomId === match2.roomId && match1.players && match1.players.length === 2) {
            pass('Quick match paired players into same room');
        } else {
            fail('Quick match pairing', `Room IDs don't match or wrong player count: ${JSON.stringify(match1)}`);
        }
    } catch (e) {
        fail('Quick match', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testLeaveRoom() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup room with both players
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        // Set up playerLeft listener before join so we catch it after leave
        const leftPromise = waitForEvent(conn2, 'playerLeft', 3000);

        // Join and wait for match ready
        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        // Player 1 leaves - player 2 should be notified
        await conn1.invoke('LeaveRoom');

        const leftData = await leftPromise;
        if (leftData.playerId) {
            pass('Leave room notifies other players');
        } else {
            fail('Leave room', 'No playerId in playerLeft event');
        }
    } catch (e) {
        fail('Leave room', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testPerformance() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup and start game
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        const gameStartPromise = waitForEvent(conn1, 'gameStart', 10000);
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');
        await gameStartPromise;

        // Measure state update timing over 2 seconds
        const timestamps = [];

        await new Promise((resolve) => {
            setTimeout(resolve, 2000);

            conn1.on('gameState', () => {
                timestamps.push(Date.now());
            });
        });

        if (timestamps.length < 2) {
            fail('Performance', `Only received ${timestamps.length} updates`);
            await conn1.stop();
            await conn2.stop();
            return;
        }

        // Calculate intervals
        const intervals = [];
        for (let i = 1; i < timestamps.length; i++) {
            intervals.push(timestamps[i] - timestamps[i-1]);
        }

        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const minInterval = Math.min(...intervals);
        const maxInterval = Math.max(...intervals);
        const actualRate = 1000 / avgInterval;

        pass(`State broadcast rate: ${actualRate.toFixed(1)} Hz (target: 20 Hz)`);
        pass(`Interval stats: avg=${avgInterval.toFixed(1)}ms, min=${minInterval}ms, max=${maxInterval}ms`);

        if (actualRate >= 15 && actualRate <= 25) {
            pass('Broadcast rate within acceptable range (15-25 Hz)');
        } else {
            fail('Broadcast rate', `Rate ${actualRate.toFixed(1)} Hz outside 15-25 Hz range`);
        }
    } catch (e) {
        fail('Performance', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testBuildCommand() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup and start game
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        const gameStartPromise = waitForEvent(conn1, 'gameStart', 10000);
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');

        const gameStart = await gameStartPromise;

        // Find a worker owned by player 1
        const worker = gameStart.world.actors.find(a =>
            a.subtype === 'worker' && a.ownerId === gameStart.playerId
        );

        if (!worker) {
            fail('Build command', 'Could not find player worker');
            await conn1.stop();
            await conn2.stop();
            return;
        }

        // Send build command
        await conn1.invoke('PlayerCommand', {
            type: 'BUILD',
            workerId: worker.id,
            buildingType: 'supplyDepot',
            x: worker.x + 100,
            y: worker.y
        });

        // Wait for building to appear
        let buildingFound = false;
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!buildingFound) {
                    reject(new Error('Building did not appear'));
                }
            }, 3000);

            conn1.on('gameState', (data) => {
                const newBuilding = data.world.actors.find(a =>
                    a.subtype === 'supplyDepot' &&
                    a.ownerId === gameStart.playerId &&
                    a.state === 'constructing'
                );
                if (newBuilding) {
                    buildingFound = true;
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        if (buildingFound) {
            pass('Build command creates building under construction');
        } else {
            fail('Build command', 'Building not found');
        }
    } catch (e) {
        fail('Build command', e);
    }

    await conn1.stop();
    await conn2.stop();
}

async function testTrainCommand() {
    const conn1 = await createConnection();
    const conn2 = await createConnection();

    try {
        // Setup and start game
        const roomPromise = waitForEvent(conn1, 'roomCreated');
        await conn1.invoke('CreateRoom');
        const roomData = await roomPromise;

        const matchReadyPromise = waitForEvent(conn1, 'matchReady');
        await conn2.invoke('JoinRoom', roomData.roomId);
        await matchReadyPromise;

        const gameStartPromise = waitForEvent(conn1, 'gameStart', 10000);
        await conn1.invoke('PlayerReady');
        await conn2.invoke('PlayerReady');

        const gameStart = await gameStartPromise;

        // Find the base owned by player 1
        const base = gameStart.world.actors.find(a =>
            a.subtype === 'base' && a.ownerId === gameStart.playerId
        );

        if (!base) {
            fail('Train command', 'Could not find player base');
            await conn1.stop();
            await conn2.stop();
            return;
        }

        // Send train command
        await conn1.invoke('PlayerCommand', {
            type: 'TRAIN',
            buildingId: base.id,
            unitType: 'worker'
        });

        // Wait for training queue to show
        let trainingStarted = false;
        await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                if (!trainingStarted) {
                    reject(new Error('Training did not start'));
                }
            }, 2000);

            conn1.on('gameState', (data) => {
                const updatedBase = data.world.actors.find(a => a.id === base.id);
                if (updatedBase && updatedBase.trainingQueue && updatedBase.trainingQueue.length > 0) {
                    trainingStarted = true;
                    clearTimeout(timeout);
                    resolve();
                }
            });
        });

        if (trainingStarted) {
            pass('Train command adds unit to training queue');
        } else {
            fail('Train command', 'Training queue not updated');
        }
    } catch (e) {
        fail('Train command', e);
    }

    await conn1.stop();
    await conn2.stop();
}

// ===== RUN ALL TESTS =====

async function runTests() {
    log('='.repeat(50));
    log('Base Ball Integration Tests - Phase 11');
    log('='.repeat(50));
    log('');

    try {
        log('--- Connection Tests ---');
        await testConnection();
        await testSetName();

        log('');
        log('--- Lobby Tests ---');
        await testCreateRoom();
        await testJoinRoom();
        await testMatchReady();
        await testQuickMatch();
        await testLeaveRoom();

        log('');
        log('--- Game Flow Tests ---');
        await testReadyAndCountdown();
        await testGameStart();
        await testGameStateUpdates();

        log('');
        log('--- Gameplay Tests ---');
        await testAvatarMovement();
        await testPlayVsAI();
        await testBuildCommand();
        await testTrainCommand();

        log('');
        log('--- Performance Tests ---');
        await testPerformance();

    } catch (e) {
        log(`Fatal error: ${e.message}`);
    }

    log('');
    log('='.repeat(50));
    log(`RESULTS: ${results.passed} passed, ${results.failed} failed`);
    log('='.repeat(50));

    process.exit(results.failed > 0 ? 1 : 0);
}

runTests();

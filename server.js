const { WebSocketServer } = require('ws');

const wss = new WebSocketServer({ port: 8080 });
let waitingPlayers = [];

console.log("Game server is running on ws://localhost:8080");

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        const data = JSON.parse(message);

        // 1. Player joins the matchmaking queue
        if (data.type === 'join') {
            ws.gameMode = data.mode; // '5min' or '10min'
            matchPlayers(ws);
        }

        // 2. Relay chat messages between paired opponents
        if (data.type === 'chat' && ws.opponent) {
            ws.opponent.send(JSON.stringify({
                type: 'chat',
                text: data.text
            }));
        }

        // 3. Handle detective's final verdict submission
        if (data.type === 'verdict' && ws.opponent) {
            ws.opponent.send(JSON.stringify({
                type: 'gameover',
                verdict: data.verdict,
                correct: data.verdict === 'ai' // Detective guessed they were pretending to be AI
            }));
            ws.send(JSON.stringify({
                type: 'gameover',
                verdict: data.verdict,
                correct: data.verdict === 'ai'
            }));
        }
    });

    ws.on('close', () => {
        // Remove from queue if they disconnect early
        waitingPlayers = waitingPlayers.filter(p => p !== ws);
        if (ws.opponent) {
            ws.opponent.send(JSON.stringify({ type: 'disconnected' }));
        }
    });
});

function matchPlayers(player) {
    // Find another player looking for the exact same time limit mode
    const match = waitingPlayers.find(p => p.gameMode === player.gameMode);

    if (match) {
        waitingPlayers = waitingPlayers.filter(p => p !== match);
        
        // Connect them as opponents
        player.opponent = match;
        match.opponent = player;

        // Randomly assign roles (One Detective, One Pretend-AI)
        const isPlayerDetective = Math.random() < 0.5;
        
        player.send(JSON.stringify({ type: 'start', role: isPlayerDetective ? 'Detective' : 'Pretend-AI', mode: player.gameMode }));
        match.send(JSON.stringify({ type: 'start', role: isPlayerDetective ? 'Pretend-AI' : 'Detective', mode: player.gameMode }));
    } else {
        waitingPlayers.push(player);
        player.send(JSON.stringify({ type: 'waiting' }));
    }
}

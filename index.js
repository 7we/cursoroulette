const websocket = require("websocket");
const http = require("http");
const fs = require("fs");

let index;
fs.readFile("web/index.html", "utf8", function (err,data) {
    if (err) {
        return console.log("Error reading web/index.html.");
    }
    index = data;
});

const httpServer = http.createServer(function (request, response) {
    response.writeHead(200);
    response.end(index);
});

httpServer.listen(80, function () {
    console.log("HTTP Server - Listening on port 80.")
});

// Array of connections. Connections each have custom properties (uuid, name, pos[x, y])
const connectionPool = [];

const ws = new websocket.server({
    httpServer: httpServer,
    autoAcceptConnections: false,
});

const adjectives = ["Red", "Blue", "Green", "Tired", "Big", "Small", "Speedy", "Slow", "Sleepy", "Woke",
                    "Slick", "Sharp", "Blurred", "Arched", "Soft", "Curved", "Spiky", "Verbose", "Special", "Spicy", "Hot", 
                    "Cold", "Cool", "Glassy", "Rough", "Responsive", "Modernized", "Majestic", "Royal", "Brave", "Rounded"];
const nouns = ["Programmer", "Tiger", "Sloth", "Elephant", "Turtle", "Lion", "Cub", "Apple", "Grape", "Lemon", "Corn", 
                    "Fruit", "Vegetable", "Fountain", "Pool", "Brick", "Dog", "Cat", "Feline", "Canine",
                    "Cactus", "Tree", "Flower", "Daffodil", "Pony", "Sink", "Bathroom", "Fridge", "Oven"];
const verbs = ["Sleeping", "Running", "Eating", "Burping", "Compiling", "Interpreting", "Loading", "Parsing", "Napping",
                    "Munching", "Listening", "Respecting", "Programming", "Running", "Awaking", "Sprinting", "Exercising",
                    "Swimming", "Working", "Cooking", "Snoring", "Printing", "Falling", "Writing", "Crying", "Yelling"];

const usedNames = [];

const selectRandomElement = (slice) => {
    return slice[Math.floor(Math.random() * slice.length)];
};

const generateRandomName = () => {
    const name = selectRandomElement(adjectives) + selectRandomElement(nouns) + selectRandomElement(verbs);

    if (usedNames.includes(name)) return generateRandomName();

    usedNames.push(name);
    return name;
};

const unloadName = (name) => {
    usedNames[name] = undefined;
};

Number.prototype.isOutOfBounds = () => {
    return this > 32767 || this < 0;
};

const isOutOfBounds = (x, y) => {
};

setInterval(() => {
    let positions = [];
    for (let conn of connectionPool) {
        let position = conn.position;
        position.s = conn.score;
        positions.push(position);
    }

    for (let conn of connectionPool) {
        conn.send(JSON.stringify(positions));
    }
}, 5);

let size = 32767 / 2;
setInterval(() => {
    let onBlue = [];
    let onRed = [];
    for (let conn of connectionPool) {
        if (conn.position.x > size) onBlue.push(conn);
        else onRed.push(conn);
    }

    if (onBlue.length === onRed.length) {
        let scores = JSON.stringify({ scores: connectionPool.map(value => {
            return { name: value.name, score: value.score }
        })});

        for (let conn of connectionPool) {
            conn.send(scores);
            conn.send(JSON.stringify({ title: "Close one!", subtitle: "Both sides are perfectly balanced!" }));
        }

        return;
    }

    let isLoser = onBlue.length > onRed.length;
    for (let conn of isLoser ? onBlue : onRed) {
        conn.send(JSON.stringify({ title: "Aw man!", subtitle: "You weren't on the right side this time!" }));
        conn.score = 0;
        console.log(`Score update - NAME: ${conn.name}, NEW SCORE: 0`);
    }

    for (let conn of !isLoser ? onBlue : onRed) {
        conn.send(JSON.stringify({ title: "Nice!", subtitle: "You won this round and were on the right side!" }));
        conn.score++;
        console.log(`Score update - NAME: ${conn.name}, NEW SCORE: ${conn.score}`);
    }

    let scores = JSON.stringify({ scores: connectionPool.map(value => {
        return { name: value.name, score: value.score }
    })});

    for (let conn of connectionPool) {
        conn.send(scores);
    }
}, 5000);

const botPool = [];

class Bot {
    constructor() {
        this.score = 0;
        this.position = { x : 32767 / 2, y : 32767 / 2 };
        this.name = generateRandomName();

        this.dx = Math.floor(Math.random() * Math.floor(50)) - 25;
        this.dy = Math.floor(Math.random() * Math.floor(50)) - 25;
    }

    send() {} // dummy method
}

for (let i = 0; i < 2; i++) {
    const bot = new Bot();
    connectionPool.push(bot);
    botPool.push(bot);
}

setInterval(() => {
    for (let bot of botPool) {
        if (bot.position.x.isOutOfBounds()) {
            bot.dx = -bot.dx;
        }

        if (bot.position.y.isOutOfBounds()) {
            bot.yx = -bot.yx;
        }
        if (isOutOfBounds(bot.position.x, bot.position.y)) {
            bot.dx = -bot.dx;
            bot.dy = -bot.dy;
        }
        bot.position.x += bot.dx;
        bot.position.y += bot.dy;
    }
}, 5);

ws.on("request", (request) => {
    /*if (connectionPool.length > 15) {
        request.reject("There are too many players connected!");
    }*/

    const connection = request.accept(null, request.origin);

    connection.score = 0;
    connection.position = { x : 0, y : 0 };
    connection.name = generateRandomName();
    connectionPool.push(connection);
    console.log(`Opened connection - NAME: ${connection.name}`);

    connection.send(JSON.stringify({ name: connection.name }));

    connection.on("message", (message) => {
        if (!/\d,\d/.test(message.utf8Data)) return;
        
        let split = message.utf8Data.split(",");
        const posX = parseInt(split[0]);
        const posY = parseInt(split[1]);

        if (posX.isOutOfBounds() || posY.isOutOfBounds()) return;
        connection.position = { x : posX, y : posY };

        console.log(`Received data - NAME: ${connection.name}, X: ${split[0]}, Y: ${split[1]}`);
    });

    connection.on("close", () => {
        unloadName(connection.name);

        const connectionIndex = connectionPool.indexOf(connection);

        if (connectionIndex > -1) {
            connectionPool.splice(connectionIndex, 1);
        }

        console.log(`Closed connection - NAME: ${connection.name}`);
    });
});
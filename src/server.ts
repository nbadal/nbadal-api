import Debug from "debug";
import {config} from "dotenv";
import http from "http";
import express from "./app";

config(); // .env

const debug = Debug("nbadal-api:server");

const port = normalizePort(process.env.PORT || "3000");
express.set("port", port);

const server = http.createServer(express);
server.listen(port);
server.on("error", onError);
server.on("listening", onListening);

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val: string) {
    const portNum = parseInt(val, 10);

    if (isNaN(portNum)) {
        // named pipe
        return val;
    }

    if (portNum >= 0) {
        // port number
        return portNum;
    }

    return false;
}

/**
 * Event listener for HTTP server "error" event.
 */

function onError(error: NodeJS.ErrnoException) {
    if (error.syscall !== "listen") {
        throw error;
    }

    const bind = typeof port === "string"
        ? "Pipe " + port
        : "Port " + port;

    // handle specific listen errors with friendly messages
    switch (error.code) {
        case "EACCES":
            debug("ERR: " + bind + " requires elevated privileges");
            process.exit(1);
            break;
        case "EADDRINUSE":
            debug("ERR: " + bind + " is already in use");
            process.exit(1);
            break;
        default:
            throw error;
    }
}

/**
 * Event listener for HTTP server "listening" event.
 */

function onListening() {
    const addr = server.address();
    const bind = typeof addr === "string"
        ? "pipe " + addr
        : "port " + addr.port;
    debug("Listening on " + bind);
}

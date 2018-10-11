import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import {Request, Response} from "express-serve-static-core";
import createError from "http-errors";
import logger from "morgan";
import path from "path";
import TrelloRouter from "./trello";

class App {
    public express: express.Application;

    constructor() {
        this.express = express();
        this.config();
    }

    private config() {

        this.express.set("views", path.join(__dirname, "views"));
        this.express.set("view engine", "pug");

        this.express.use(logger("dev"));
        this.express.use(express.json());
        this.express.use(express.urlencoded({extended: false}));
        this.express.use(cookieParser());
        this.express.use(express.static(path.join(__dirname, "public")));
        this.express.use(cors());

        this.express.get("/", (req, res) => {
            res.redirect(301, "https://nbad.al");
        });

        this.express.use("/trello", TrelloRouter);

        this.express.use((req, res, next) => {
            next(createError(404));
        });
        this.express.use((err: any, req: Request, res: Response) => {
            // set locals, only providing error in development
            res.locals.message = err.message;
            res.locals.status = err.status;
            res.locals.stack = this.express.get("env") === "development" ? err.stack : "";

            // render the error page
            res.status(err.status || 500);
            res.render("error");
        });
    }
}

export default new App().express;

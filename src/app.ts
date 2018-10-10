import cookieParser from "cookie-parser";
import express from "express";
import {Request, Response} from "express-serve-static-core";
import createError from "http-errors";
import logger from "morgan";
import Trello from "node-trello";
import path from "path";
import {bindNodeCallback} from "rxjs";
import {first, map, mergeMap} from "rxjs/operators";

class App {
    public express: express.Application;

    private trelloApi: Trello;
    private trelloGet = bindNodeCallback((uri: string, args: object,
                                          callback: (err: Error, body: any) => void) => {
        this.trelloApi.get(uri, args, callback);
    });

    constructor() {
        try {
            this.trelloApi = new Trello(process.env.TRELLO_API_KEY as string,
                process.env.TRELLO_TOKEN as string);
        } catch (err) {
            throw Error("Trello API keys not set or invalid!");
        }
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

        // TODO: should this be disabled for prod???
        this.express.all("/trello", ((req, res, next) => {
            res.header("Access-Control-Allow-Origin", "*");
            res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
            next();
        }));

        this.express.get("/", (req, res) => {
            res.redirect(301, "https://nbad.al");
        });
        this.express.get("/trello", (req, res) => {
            const boardId = "0vBMcbdj";
            const listName = "Todo";

            this.trelloGet(`/1/boards/${boardId}/lists`, {fields: "name", cards: "open", card_fields: "name"})
                .pipe(mergeMap((lists: any) => lists as any[]),
                    first((list: any) => list.name.toLowerCase() === listName.toLowerCase()),
                    map((list: any) => list.cards))
                .subscribe((result: any) => {
                    res.json(result);
                }, (err: Error) => {
                    res.json({error: err});
                });
        });

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

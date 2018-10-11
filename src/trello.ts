import express from "express";
import {NextFunction, Request, Response} from "express-serve-static-core";
import Trello from "node-trello";
import {bindNodeCallback} from "rxjs";
import {first, map, mergeMap} from "rxjs/operators";

const router = express.Router();
let trelloApi: Trello;
const trelloGet = bindNodeCallback((uri: string, args: object,
                                    callback: (err: Error, body: any) => void) => {
    trelloApi.get(uri, args, callback);
});

try {
    trelloApi = new Trello(process.env.TRELLO_API_KEY as string,
        process.env.TRELLO_TOKEN as string);
} catch (err) {
    throw Error("Trello API keys not set or invalid!");
}

const enableCors = (req: Request, res: Response, next: NextFunction) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
};

router.all("/", enableCors);
router.get("/", (req, res) => {
    const boardId = "0vBMcbdj";
    const listName = "Todo";

    trelloGet(`/1/boards/${boardId}/lists`, {fields: "name", cards: "open", card_fields: "name"})
        .pipe(mergeMap((lists: any) => lists as any[]),
            first((list: any) => list.name.toLowerCase() === listName.toLowerCase()),
            map((list: any) => list.cards))
        .subscribe((result: any) => {
            res.json(result);
        }, (err: Error) => {
            res.json({error: err});
        });
});
router.post("/", (req, res) => {
    console.log("Got Trello POST: " + JSON.stringify(req.body));
    res.sendStatus(200);
});

export = router;

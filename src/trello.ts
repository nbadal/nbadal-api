import express from "express";
import Trello from "node-trello";
import {bindNodeCallback, timer} from "rxjs";
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

function getTrelloCards() {
    const boardId = "0vBMcbdj";
    const listName = "Todo";
    return trelloGet(`/1/boards/${boardId}/lists`, {fields: "name", cards: "open", card_fields: "name"})
        .pipe(mergeMap((lists: any) => lists as any[]),
            first((list: any) => list.name.toLowerCase() === listName.toLowerCase()),
            map((list: any) => list.cards));
}

router.get("/", (req, res, next) => {
    if ("text/event-stream" === req.header("accept")) {
        res.writeHead(200, {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        });
        timer(0, 10000)
            .pipe(mergeMap(() => getTrelloCards()))
            .subscribe((cards) => {
                res.write(`data: ${JSON.stringify(cards)}\n\n`);
            });
    } else {
        next();
    }
});

router.get("/", (req, res) => {
    getTrelloCards()
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

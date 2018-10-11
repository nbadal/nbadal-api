import express from "express";
import Trello from "node-trello";
import {BehaviorSubject, bindNodeCallback} from "rxjs";
import {filter, map, mergeMap, reduce} from "rxjs/operators";

const router = express.Router();
let trelloApi: Trello;
const trelloGet = bindNodeCallback((uri: string, args: object,
                                    callback: (err: Error, body: any) => void) => {
    trelloApi.get(uri, args, callback);
});
const trelloUpdateSubject = new BehaviorSubject(true);

try {
    trelloApi = new Trello(process.env.TRELLO_API_KEY as string,
        process.env.TRELLO_TOKEN as string);
} catch (err) {
    throw Error("Trello API keys not set or invalid!");
}

function getTrelloCards() {
    const boardId = "0vBMcbdj";
    const listNames = ["in progress", "todo"];
    const listArgs = {fields: "name", cards: "open", card_fields: "name"};

    return trelloGet(`/1/boards/${boardId}/lists`, listArgs).pipe(
        mergeMap((lists) => lists as any[]),
        filter((list) => listNames.indexOf(list.name.toLowerCase()) >= 0),
        reduce((listMap: any, list) => {
            const formattedName = list.name.replace(" ", "-").toLowerCase();
            listMap[formattedName] = list.cards;
            return listMap;
        }, {}),
    );
}

router.get("/", (req, res, next) => {
    if ("text/event-stream" === req.header("accept")) {
        res.writeHead(200, {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        });
        const trelloSub = trelloUpdateSubject.pipe(
            mergeMap(() => getTrelloCards()),
            map((cards) => JSON.stringify(cards)),
            map((cards) => `data: ${cards}\n\n`),
        ).subscribe((msg) => res.write(msg));
        req.on("close", () => trelloSub.unsubscribe());
    } else {
        next();
    }
});

router.get("/", (req, res) => {
    getTrelloCards().subscribe((result) => {
        res.json(result);
    }, (err: Error) => {
        res.json({error: err});
    });
});
router.post("/", (req, res) => {
    // console.log("Got Trello POST: " + JSON.stringify(req.body));
    trelloUpdateSubject.next(true);
    res.sendStatus(200);
});

export = router;

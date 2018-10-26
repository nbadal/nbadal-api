import express from "express";
import {BehaviorSubject, Observable, Subject} from "rxjs";
import {map, mergeMap} from "rxjs/operators";
import firebase from "./firebase";
import {trelloRequest} from "./trello-request";
import {OverlayData, OverlayResponse, TrelloList, UserData, UserTrelloAuth} from "./types";

const router = express.Router();
const trelloUpdateSubject = new BehaviorSubject(true);

function getOverlayFromId(id: string): Observable<OverlayResponse> {
    const resultSubject = new Subject<OverlayResponse>();
    firebase.firestore().doc(`overlays/${id}`).get().then((overlayDoc) => {
        const overlayData = overlayDoc.data() as OverlayData;
        if (!overlayData) {
            resultSubject.error({error: "Overlay not found."});
            return;
        }

        const userId = overlayData.user;

        firebase.firestore().doc(`users/${userId}`).get().then((userDoc) => {
            const userData = userDoc.data() as UserData;
            if (!userData) {
                resultSubject.error({error: "User not found."});
                return;
            }

            const auth = userData.trelloAuth;

            getOverlay(overlayData, auth).subscribe(resultSubject);
        });
    });
    return resultSubject;
}

function getOverlay(overlayData: OverlayData, trelloCreds: UserTrelloAuth): Observable<OverlayResponse> {
    return trelloRequest<TrelloList[]>(`https://api.trello.com/1/boards/${overlayData.board}/lists`
        + `?fields=name&cards=open&card_fields=name`,
        "GET", trelloCreds.token, trelloCreds.secret)
        .pipe(map((boardLists) => {
            const listData = boardLists
                .filter((list) => overlayData.lists.indexOf(list.id) >= 0)
                .map((list) => {
                    list.name = list.name.replace(" ", "-").toLowerCase();
                    return list;
                });

            return {
                lists: listData,
                title: overlayData.title,
            };
        }));
}

router.get("/:id", (req, res, next) => {
    if (!req.params.id) {
        return next();
    }

    const overlayId = req.params.id;
    if ("text/event-stream" === req.header("accept")) {
        res.writeHead(200, {
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Content-Type": "text/event-stream",
        });
        const trelloSub = trelloUpdateSubject.pipe(
            mergeMap(() => getOverlayFromId(overlayId)),
            map((cards) => JSON.stringify(cards)),
            map((cards) => `data: ${cards}\n\n`),
        ).subscribe((msg) => res.write(msg));
        req.on("close", () => trelloSub.unsubscribe());
    } else {
        next();
    }
});

router.get("/:id", (req, res, next) => {
    if (!req.params.id) {
        return next();
    }

    const overlayId = req.params.id;
    getOverlayFromId(overlayId).subscribe((overlay) => {
        res.json(overlay);
    }, (error) => {
        res.json(error);
    });

});

router.post("/", (req, res) => {
    console.log("Got Trello POST: " + JSON.stringify(req.body));
    trelloUpdateSubject.next(true);
    res.sendStatus(200);
});

export = router;

import express from "express";
import Trello from "node-trello";
import {OAuth} from "oauth";
import {BehaviorSubject, bindNodeCallback, Observable, Subscriber} from "rxjs";
import {filter, map, mergeMap, reduce} from "rxjs/operators";
import firebase from "./firebase";

let trelloKey: string;
let trelloSecret: string;

try {
    trelloKey = process.env.TRELLO_API_KEY as string;
    trelloSecret = process.env.TRELLO_API_SECRET as string;
} catch (err) {
    throw Error("Trello API keys not set or invalid!");
}

const router = express.Router();
const trelloApi = new Trello(trelloKey, trelloSecret);
const trelloGet = bindNodeCallback((uri: string, args: object,
                                    callback: (err: Error, body: any) => void) => {
    trelloApi.get(uri, args, callback);
});
const trelloUpdateSubject = new BehaviorSubject(true);

const appName = "Trello Twitch Overlay";
const requestURL = "https://trello.com/1/OAuthGetRequestToken";
const accessURL = "https://trello.com/1/OAuthGetAccessToken";
const authorizeURL = "https://trello.com/1/OAuthAuthorizeToken";
const loginCallback = `http://localhost:3000/trello/callback`;
const trelloAuth = new OAuth(requestURL, accessURL, trelloKey, trelloSecret,
    "1.0A", loginCallback, "HMAC-SHA1");

function getTrelloCards() {
    const boardId = "0vBMcbdj";
    const listNames = ["in progress", "todo"];
    const listArgs = {fields: "name", cards: "open", card_fields: "name"};

    return trelloGet(`/1/boards/${boardId}/lists`, listArgs).pipe(
        mergeMap((lists) => lists as any[]),
        filter((list) => listNames.indexOf(list.name.toLowerCase()) >= 0),
        reduce((listArray: any, list) => {
            const formattedName = list.name.replace(" ", "-").toLowerCase();
            listArray.push({name: formattedName, cards: list.cards});
            return listArray;
        }, []),
    );
}

function bindOauthRequest(url: string, method: string, token: string, secret: string): Observable<any> {
    return Observable.create((observer: Subscriber<any>) => {
        trelloAuth.getProtectedResource(url, method, token, secret, (err, result) => {
            if (err) {
                observer.error(err);
                return;
            }
            if (typeof result !== "string") {
                observer.error("Not a string");
                return;
            }
            observer.next(JSON.parse(result as string));
            observer.complete();
        });
    });
}

router.get("/:id", (req, res, next) => {
    if (!req.params.id) {
        return next();
    }

    const overlayId = req.params.id;
    firebase.firestore().doc(`overlays/${overlayId}`).get().then((overlayDoc) => {
        const overlayData = overlayDoc.data();
        if (!overlayData) {
            res.sendStatus(400);
            return;
        }

        const userId = overlayData.user;
        const board = overlayData.board;
        const lists = overlayData.lists as string[];
        const title = overlayData.title;

        firebase.firestore().doc(`users/${userId}`).get().then((userDoc) => {
            const userData = userDoc.data();
            if (!userData) {
                res.sendStatus(404);
                return;
            }

            const auth = userData.trelloAuth;
            bindOauthRequest(`https://api.trello.com/1/boards/${board}/lists`
                + `?fields=name&cards=open&card_fields=name`,
                "GET", auth.token, auth.secret).subscribe((boardLists: any[]) => {
                const listData = boardLists
                    .filter((list) => lists.indexOf(list.id) >= 0)
                    .map((list) => {
                        const formattedName = list.name.replace(" ", "-").toLowerCase();
                        return {name: formattedName, cards: list.cards};
                    });

                const result = {
                    lists: listData,
                    title,
                };

                res.json(result);
            });
        });
    });
});

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

router.get("/redirect", (req, res) => {
    const userToken = req.query.user_token;

    if (!userToken) {
        res.sendStatus(400);
    }

    firebase.auth().verifyIdToken(userToken).then((decoded) => {
        const userId = decoded.uid;

        trelloAuth.getOAuthRequestToken((err, token, tokenSecret) => {
            if (err) {
                res.send(err);
                return;
            }

            firebase.firestore().collection("trelloRequests").doc(token).set({
                tokenSecret,
                userId,
            }).then(() => {
                res.redirect(`${authorizeURL}?oauth_token=${token}&name=${appName}&expiration=never`);
            });
        });
    });
});

router.get("/callback", (req, res) => {
    const token = req.query.oauth_token;
    const verifier = req.query.oauth_verifier;

    if (!token) {
        res.redirect(process.env.CLIENT_URL || "http://localhost:4200");
    }

    firebase.firestore().collection("trelloRequests").doc(token).get().then((doc) => {
        const data = doc.data();
        if (!data) {
            res.sendStatus(400);
            return;
        }

        const tokenSecret = data.tokenSecret;
        const user = data.userId;

        trelloAuth.getOAuthAccessToken(token, tokenSecret, verifier, (err, accessToken, accessTokenSecret) => {
            firebase.firestore().collection("users").doc(user).update({
                trelloAuth: {
                    secret: accessTokenSecret,
                    token: accessToken,
                },
            }).then(() => {
                res.redirect(process.env.CLIENT_URL || "http://localhost:4200");
            });
        });
    });
});

export = router;

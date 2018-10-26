import express from "express";
import firebase from "./firebase";
import {getTrelloAccessToken, getTrelloRequestToken, trelloAuthUrl} from "./trello-request";

const router = express.Router();

router.get("/redirect", (req, res) => {
    const userToken = req.query.user_token;

    if (!userToken) {
        res.sendStatus(400);
    }

    firebase.auth().verifyIdToken(userToken).then((decoded) => {
        const userId = decoded.uid;

        getTrelloRequestToken().then((requestToken) => {
            firebase.firestore().collection("trelloRequests").doc(requestToken.token).set({
                tokenSecret: requestToken.tokenSecret,
                userId,
            }).then(() => {
                res.redirect(trelloAuthUrl(requestToken.token));
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

        getTrelloAccessToken(token, tokenSecret, verifier).then((result) => {
            firebase.firestore().collection("users").doc(user).update({
                trelloAuth: {
                    secret: result.accessTokenSecret,
                    token: result.accessToken,
                },
            }).then(() => {
                res.redirect(process.env.CLIENT_URL || "http://localhost:4200");
            });
        });
    });
});

export = router;

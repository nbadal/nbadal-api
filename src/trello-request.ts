import {OAuth} from "oauth";
import {Observable, Subscriber} from "rxjs";

let appKey: string;
let appSecret: string;

try {
    appKey = process.env.TRELLO_API_KEY as string;
    appSecret = process.env.TRELLO_API_SECRET as string;
} catch (err) {
    throw Error("Trello API keys not set or invalid!");
}

const appName = "Trello Twitch Overlay";
const authorizeURL = "https://trello.com/1/OAuthAuthorizeToken";

const oauthClient = new OAuth("https://trello.com/1/OAuthGetRequestToken",
    "https://trello.com/1/OAuthGetAccessToken",
    appKey, appSecret,
    "1.0A",
    `http://localhost:3000/trello/callback`,
    "HMAC-SHA1");

export function trelloRequest<T>(url: string, method: string, token: string, secret: string): Observable<T> {
    return Observable.create((observer: Subscriber<any>) => {
        oauthClient.getProtectedResource(url, method, token, secret, (err, result) => {
            if (err) {
                observer.error(err);
                return;
            }
            if (typeof result !== "string") {
                observer.error("Not a string");
                return;
            }
            observer.next(JSON.parse(result as string) as T);
            observer.complete();
        });
    });
}

interface TrelloRequestToken {
    token: string;
    tokenSecret: string;
}

export function getTrelloRequestToken(): Promise<TrelloRequestToken> {
    return new Promise<TrelloRequestToken>(((resolve, reject) => {
        oauthClient.getOAuthRequestToken(((err, token, tokenSecret) => {
            if (err) {
                reject(err);
                return;
            }
            resolve({token, tokenSecret});
        }));
    }));
}

export function trelloAuthUrl(token: string): string {
    return `${authorizeURL}?oauth_token=${token}&name=${appName}&expiration=never`;
}

interface TrelloAccessToken {
    accessToken: string;
    accessTokenSecret: string;
}

export function getTrelloAccessToken(oauthToken: string, oauthTokenSecret: string, verifier: string) {
    return new Promise<TrelloAccessToken>(((resolve, reject) => {
        oauthClient.getOAuthAccessToken(oauthToken, oauthTokenSecret, verifier,
            ((err, accessToken, accessTokenSecret) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve({accessToken, accessTokenSecret});
            }));
    }));
}

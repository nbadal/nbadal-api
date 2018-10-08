declare module "node-trello" {
    export = Trello;
}

declare class Trello {
    /** Creates a new Trello request wrapper. */
    constructor(key: string, token: string);

    /** Make a GET request to Trello. */
    public get(uri: string, args: object, callback: (err: Error, body: any) => void): void;
    public get(uri: string, callback: (err: Error, body: any) => void): void;

    /** Make a POST request to Trello. */
    public post(uri: string, args: object, callback: (err: Error, body: any) => void): void;
    public post(uri: string, callback: (err: Error, body: any) => void): void;

    /** Make a PUT request to Trello. */
    public put(uri: string, args: object, callback: (err: Error, body: any) => void): void;
    public put(uri: string, callback: (err: Error, body: any) => void): void;

    /** Make a DELETE request to Trello. */
    public del(uri: string, args: object, callback: (err: Error, body: any) => void): void;
    public del(uri: string, callback: (err: Error, body: any) => void): void;

    /** Make a request to Trello. */
    public request(method: string, uri: string, args: object, callback: (err: Error, body: any) => void): void;
    public request(method: string, uri: string, callback: (err: Error, body: any) => void): void;
}

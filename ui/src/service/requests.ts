import * as path from 'path';
import * as agent from 'superagent';

import {BehaviorSubject, Observable, Observer} from 'rxjs';
import {filter} from 'rxjs/operators';
import {EventSource} from 'eventsource'

enum ReadyState {
    CONNECTING = 0,
    OPEN = 1,
    CLOSED = 2,
    DONE = 4
}

let baseHRef = '/';

const onError = new BehaviorSubject<agent.ResponseError>(null);

function toAbsURL(val: string): string {
    return path.join(baseHRef, val);
}

function apiRoot(absoluteUrl: boolean): string {
    if (absoluteUrl) {
        return '';
    }
    return toAbsURL('/api/v1');
}

function initHandlers(req: agent.Request) {
    req.on('error', err => {
        if (err && err.response && err.response.body) {
            err.message = err.message + (typeof err.response.body === 'string' ? (': ' + err.response.body) : (': ' + JSON.stringify(err.response.body)));
            err.body = err.response.body;
        }
        if (err && err.response && err.response.text) {
            err.message = err.message + (': ' + err.response.text);
        }
        onError.next(err);
    });
    return req;
}

export default {
    setBaseHRef(val: string) {
        baseHRef = val;
    },
    agent,
    toAbsURL,
    onError: onError.asObservable().pipe(filter(err => err != null)),
    get(url: string, absoluteUrl = false) {
        return initHandlers(agent.get(`${apiRoot(absoluteUrl)}${url}`));
    },

    post(url: string, absoluteUrl = false) {
        return initHandlers(agent.post(`${apiRoot(absoluteUrl)}${url}`));
    },

    postJson(url: string, absoluteUrl = false) {
        return initHandlers(agent.post(`${apiRoot(absoluteUrl)}${url}`)).set('Content-Type', 'application/json');
    },

    putJson(url: string, absoluteUrl = false) {
        return initHandlers(agent.put(`${apiRoot(absoluteUrl)}${url}`)).set('Content-Type', 'application/json');
    },

    patchJson(url: string, absoluteUrl = false) {
        return initHandlers(agent.patch(`${apiRoot(absoluteUrl)}${url}`)).set('Content-Type', 'application/json');
    },

    deleteJson(url: string, absoluteUrl = false) {
        return initHandlers(agent.del(`${apiRoot(absoluteUrl)}${url}`)).set('Content-Type', 'application/json');
    },

    loadEventSource(url: string, headers: Record<string, string> = {}, absoluteUrl = false): Observable<string> {
        return Observable.create((observer: Observer<any>) => {
            let eventSource = new EventSource(`${apiRoot(absoluteUrl)}${url}`, {
                fetch: (input, init) =>
                    fetch(input, {
                        ...init,
                        headers: {
                            ...init.headers,
                            ...headers
                        },
                    }),
            });
            eventSource.onmessage = msg => observer.next(msg.data);
            eventSource.onerror = e => () => {
                observer.error(e);
                onError.next(e);
            };

            // EventSource does not provide easy way to get notification when connection closed.
            // check readyState periodically instead.
            const interval = setInterval(() => {
                if (eventSource && eventSource.readyState === ReadyState.CLOSED) {
                    observer.error('connection got closed unexpectedly');
                }
            }, 500);
            return () => {
                clearInterval(interval);
                eventSource.close();
                eventSource = null;
            };
        });
    }
};

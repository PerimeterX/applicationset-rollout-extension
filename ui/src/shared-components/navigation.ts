import * as React from 'react';
import {createBrowserHistory, History} from 'history';

export class NavigationManager {

    public history: History;

    constructor() {
        const bases = document.getElementsByTagName('base');
        const base = bases.length > 0 ? bases[0].getAttribute('href') || '/' : '/';
        this.history = createBrowserHistory({basename: base});
    }

    public goto(path: string, query: {[name: string]: any} = {}, options?: { event?: React.MouseEvent, replace?: boolean }): void {
        if (path.startsWith('.')) {
            path = this.history.location.pathname + path.slice(1);
        }
        const noPathChange = path === this.history.location.pathname;
        const params = noPathChange ? new URLSearchParams(this.history.location.search) : new URLSearchParams();
        for (const name of Object.keys(query)) {
            const val = query[name];
            params.delete(name);
            if (val !== undefined && val !== null) {
                if (val instanceof Array) {
                    for (const item of val) {
                        params.append(name, item);
                    }
                } else {
                    params.set(name, val);
                }
            }
        }
        const urlQuery = params.toString();
        if (urlQuery !== '') {
            path = `${path}?${urlQuery}`;
        }
        options = options || {};
        if (options.event && (options.event.metaKey || options.event.ctrlKey || options.event.button === 1)) {
            window.open(path, '_blank');
        } else {
            if (options.replace) {
                this.history.replace(path);
            } else {
                this.history.push(path);
            }
        }
    }
}

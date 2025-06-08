import * as React from 'react';
import {useCallback, useEffect, useState} from 'react';
import {Terminal} from 'xterm';
import {FitAddon} from 'xterm-addon-fit';
import {debounceTime, takeUntil} from 'rxjs/operators';
import {fromEvent, ReplaySubject, Subject} from 'rxjs';
import {DebugPod} from '../../models/pod-models';
import {Notification} from '../../shared-components/notification-bar/notification-bar';

import './pod-terminal-viewer.scss';
import 'xterm/css/xterm.css';

export interface PodTerminalViewerProps {
    selectedPod: DebugPod;
    applicationName: string;
    applicationNamespace: string;
    projectName: string;
    setNotification: (notification: Notification) => void;
}

export interface ShellFrame {
    operation: string;
    data?: string;
    rows?: number;
    cols?: number;
}

export const PodTerminalViewer: React.FC<PodTerminalViewerProps> = ({
    setNotification,
    selectedPod,
    applicationName,
    applicationNamespace,
    projectName
}) => {
    const [containerIndex, setContainerIndex] = useState(0);
    const terminalRef = React.useRef(null);
    const fitAddon = new FitAddon();
    let terminal: Terminal;
    let webSocket: WebSocket;
    const keyEvent = new ReplaySubject<KeyboardEvent>(2);
    let connSubject = new ReplaySubject<ShellFrame>(100);
    let incommingMessage = new Subject<ShellFrame>();
    const unsubscribe = new Subject<void>();
    let connected = false;

    const onTerminalSendString = (str: string) => {
        if (connected) {
            webSocket.send(JSON.stringify({operation: 'stdin', data: str, rows: terminal.rows, cols: terminal.cols}));
        }
    };

    const onTerminalResize = () => {
        if (connected) {
            webSocket.send(
                JSON.stringify({
                    operation: 'resize',
                    cols: terminal.cols,
                    rows: terminal.rows
                })
            );
        }
    };

    const onConnectionMessage = (e: MessageEvent) => {
        const msg = JSON.parse(e.data);
        if (!msg?.Code) {
            connSubject.next(msg);
        } else {
            // Do reconnect due to refresh token event
            onConnectionClose();
            setupConnection();
        }
    };

    const onConnectionOpen = () => {
        connected = true;
        onTerminalResize(); // fit the screen first time
        terminal.focus();
    };

    const onConnectionClose = () => {
        if (!connected) return;
        if (webSocket) webSocket.close();
        connected = false;
    };

    const handleConnectionMessage = (frame: ShellFrame) => {
        terminal.write(frame.data);
        incommingMessage.next(frame);
    };

    const disconnect = () => {
        if (webSocket) {
            webSocket.close();
        }

        if (connSubject) {
            connSubject.complete();
            connSubject = new ReplaySubject<ShellFrame>(100);
        }

        if (terminal) {
            terminal.dispose();
        }

        incommingMessage.complete();
        incommingMessage = new Subject<ShellFrame>();
    };

    function initTerminal(node: HTMLElement) {
        if (connSubject) {
            connSubject.complete();
            connSubject = new ReplaySubject<ShellFrame>(100);
        }

        if (terminal) {
            terminal.dispose();
        }

        terminal = new Terminal({
            convertEol: true,
            fontFamily: 'Menlo, Monaco, Courier New, monospace',
            bellStyle: 'sound',
            fontSize: 14,
            fontWeight: 400,
            cursorBlink: true
        });
        terminal.options = {
            theme: {
                background: '#333'
            }
        };
        terminal.loadAddon(fitAddon);
        terminal.open(node);
        fitAddon.fit();

        connSubject.pipe(takeUntil(unsubscribe)).subscribe(frame => {
            handleConnectionMessage(frame);
        });

        terminal.onResize(onTerminalResize);
        terminal.onKey(key => {
            keyEvent.next(key.domEvent);
        });
        terminal.onData(onTerminalSendString);
    }

    function setupConnection() {
        if (!selectedPod) {
            setNotification({message: 'No pod selected', type: 'error'});
            return;
        }

        const containers = selectedPod.pod.spec.containers.concat(selectedPod.pod.spec.initContainers || []);

        if (containers.length < containerIndex) {
            setNotification({message: 'No container selected', type: 'error'});
            return;
        }

        const name = selectedPod.pod.metadata.name;
        const namespace = selectedPod.pod.metadata.namespace;
        const containerName = containers[containerIndex].name;
        const url = location.host.replace(/\/$/, '');
        webSocket = new WebSocket(
            `${
                location.protocol === 'https:' ? 'wss' : 'ws'
            }://${url}/terminal?pod=${name}&container=${containerName}&appName=${applicationName}&appNamespace=${applicationNamespace}&projectName=${projectName}&namespace=${namespace}`
        );
        webSocket.onopen = onConnectionOpen;
        webSocket.onclose = onConnectionClose;
        webSocket.onerror = e => {
            setNotification({message: `Terminal Connection Error: ${e}`, type: 'error'});
            onConnectionClose();
        };
        webSocket.onmessage = onConnectionMessage;
    }

    const setTerminalRef = useCallback(
        node => {
            if (terminal && connected) {
                disconnect();
            }

            if (node) {
                initTerminal(node);
                setupConnection();
            }

            // Save a reference to the node
            terminalRef.current = node;
        },
        [containerIndex]
    );

    useEffect(() => {
        const resizeHandler = fromEvent(window, 'resize')
            .pipe(debounceTime(1000))
            .subscribe(() => {
                if (fitAddon) {
                    fitAddon.fit();
                }
            });
        return () => {
            resizeHandler.unsubscribe(); // unsubscribe resize callback
            unsubscribe.next();
            unsubscribe.complete();

            // clear connection and close terminal
            if (webSocket) {
                webSocket.close();
            }

            if (connSubject) {
                connSubject.complete();
            }

            if (terminal) {
                terminal.dispose();
            }

            incommingMessage.complete();
        };
    }, [containerIndex]);

    const containers = selectedPod.pod.spec.containers.concat(selectedPod.pod.spec.initContainers || []);
    return (
        <div className='row'>
            <div className='columns small-3 medium-2'>
                {containers.map((container, i) => (
                    <div
                        className='application-details__container'
                        key={container.name}
                        onClick={() => {
                            if (i !== containerIndex) {
                                disconnect();
                                setContainerIndex(i);
                            }
                        }}>
                        <span title={container.name} style={{fontWeight: i === containerIndex ? 'bold' : 'normal'}}>{container.name}</span>
                    </div>
                ))}
            </div>
            <div className='columns small-9 medium-10'>
                <div ref={setTerminalRef} className='pod-terminal-viewer' />
            </div>
        </div>
    );
};

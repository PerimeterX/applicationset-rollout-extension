import * as PropTypes from 'prop-types';
import * as React from 'react';
import { Observable, Subscription } from 'rxjs';
import {NotificationBar, Notification} from './notification-bar/notification-bar';

export function isPromise<T>(obj: any): obj is PromiseLike<T> {
    return !!obj && (typeof obj === 'object' || typeof obj === 'function') && typeof obj.then === 'function';
}

interface LoaderProps<TInput, TResult> {
    load: (input: TInput) => Promise<TResult> | Observable<TResult>;
    input: TInput;
    noLoaderOnInputChange?: boolean;
    loadingRenderer?: React.ComponentType;
    errorRenderer?: (children: React.ReactNode) => React.ReactNode;
    children: (data: TResult) => React.ReactNode;
}

interface LoaderPropsNoInput<TResult> {
    load: () => Promise<TResult> | Observable<TResult>;
    noLoaderOnInputChange?: boolean;
    loadingRenderer?: React.ComponentType;
    errorRenderer?: (children: React.ReactNode) => React.ReactNode;
    children: (data: TResult) => React.ReactNode;
}

interface LoaderState<TInput, TResult> {
  loading: boolean;
  dataWrapper: { data: TResult } | null;
  error: boolean;
  input: TInput;
  inputChanged: boolean;
  notification: Notification | null;
}

export class DataLoader<D = {}, I = undefined> extends React.Component<LoaderProps<I, D> | LoaderPropsNoInput<D>, LoaderState<I, D>> {
    public static contextTypes = {
        router: PropTypes.object,
        apis: PropTypes.object,
    };

    public static getDerivedStateFromProps(nextProps: LoaderProps<any, any>, prevState: { input: any }) {
        if (JSON.stringify(nextProps.input) !== JSON.stringify(prevState.input)) {
            return { inputChanged: true, input: nextProps.input };
        }
        return null;
    }

    private subscription: Subscription | null = null;
    private unmounted = false;

    constructor(props: LoaderProps<I, D>) {
        super(props);
        this.state = { loading: false, error: false, dataWrapper: null, input: props.input, inputChanged: false, notification: null };
    }

    public getData() {
        return this.state.dataWrapper && this.state.dataWrapper.data || null;
    }

    public setData(data: D) {
        return this.setState({ dataWrapper: { data } });
    }

    public componentDidMount() {
        this.loadData();
    }

    public componentDidUpdate() {
        this.loadData();
    }

    public componentWillUnmount() {
        this.ensureUnsubscribed();
        this.unmounted = true;
    }

    public render() {
        return <>
            {this.renderContent()}
            {this.state.notification && (
                <NotificationBar
                    message={this.state.notification.message}
                    type={this.state.notification.type}
                    onClose={() => this.setState({notification: null})}
                    requireApproval={this.state.notification.requireApproval}
                />
            )}
        </>;
    }

    public renderContent() {
        const style: React.CSSProperties = {padding: '0.5em', textAlign: 'center'};
        if (this.state.error) {
            const error = <p style={style}>Failed to load data, please <a onClick={() => this.reload()}>try again</a>.</p>;
            if (this.props.errorRenderer) {
                return this.props.errorRenderer(error);
            }
            return error;
        }
        if (this.state.dataWrapper) {
            return this.props.children(this.state.dataWrapper.data);
        }
        return this.props.loadingRenderer ? <this.props.loadingRenderer/> : <p style={style}>Loading...</p>;
    }

    public reload() {
        this.setState({ dataWrapper: null, error: false, inputChanged: true });
    }

    private async loadData() {
        if (!this.state.error && !this.state.loading && this.state.dataWrapper == null || this.state.inputChanged) {
            this.setState({ error: false, loading: true, inputChanged: false, dataWrapper: this.props.noLoaderOnInputChange ? this.state.dataWrapper : null });
            try {
                const res = 'input' in this.props ? this.props.load(this.props.input) : this.props.load();

                if (isPromise(res)) {
                    const data = await res;
                    if (!this.unmounted) {
                        this.setState({ dataWrapper: { data }, loading: false });
                    }
                } else {
                    this.ensureUnsubscribed();
                    this.subscription = res.subscribe((data: D) => {
                        this.setState({ loading: false, dataWrapper: { data } });
                    }, (e) => {
                        this.handleError(e);
                    }, () => {
                        if (this.state.loading) {
                            // observable might complete before returning any data
                            // make sure to reset loading state
                            this.setState({ loading: false, dataWrapper: { data: this.state.dataWrapper?.data } });
                        }
                    });
                }
            } catch (e) {
                this.handleError(e);
            }
        }
    }

    private handleError(e: any) {
        if (!this.unmounted) {
            this.setState({ error: true, loading: false, inputChanged: false });
            if (e.status !== 401) {
                this.setState({notification: {message: 'Unable to load data', type: 'error'}});
            }
        }
    }

    private ensureUnsubscribed() {
        if (this.subscription) {
            this.subscription.unsubscribe();
        }
        this.subscription = null;
    }

}

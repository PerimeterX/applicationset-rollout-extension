import * as React from 'react';
import * as jsYaml from 'js-yaml';
import * as monacoEditor from 'monaco-editor';
import {MonacoEditor} from './monaco-editor';
import {NotificationBar} from '../notification-bar/notification-bar';
import './yaml-editor.scss';

export class YamlEditor<T> extends React.Component<
    {
        input: T;
        hideModeButtons?: boolean;
        initialEditMode?: boolean;
        vScrollbar?: boolean;
        onSave?: (data: any) => Promise<any>;
        onCancel?: () => any;
        minHeight?: number;
    },
    {
        editing: boolean;
        notification: {message: string; type: 'success' | 'error'} | null;
    }
> {
    private model: monacoEditor.editor.ITextModel;

    constructor(props: any) {
        super(props);
        this.state = {
            editing: props.initialEditMode,
            notification: null
        };
    }

    public render() {
        const props = this.props;
        const yaml = props.input ? jsYaml.dump(props.input) : '';

        return (
            <div className='yaml-editor'>
                {!props.hideModeButtons && (
                    <div className='yaml-editor__buttons'>
                        {(this.state.editing && (
                            <>
                                <button
                                    onClick={async () => {
                                        try {
                                            const updated = jsYaml.load(this.model.getLinesContent().join('\n'));
                                            try {
                                                const unmounted = await this.props.onSave(updated);
                                                if (unmounted !== true) {
                                                    this.setState({editing: false});
                                                }
                                            } catch (e) {
                                                this.setState({
                                                    notification: {
                                                        message: `Unable to save changes: ${e.message}`,
                                                        type: 'error'
                                                    }
                                                });
                                            }
                                        } catch (e) {
                                            this.setState({
                                                notification: {
                                                    message: `Unable to validate changes: ${e.message}`,
                                                    type: 'error'
                                                }
                                            });
                                        }
                                    }}
                                    className='argo-button argo-button--base'>
                                    Save
                                </button>{' '}
                                <button
                                    onClick={() => {
                                        this.model.setValue(jsYaml.dump(props.input));
                                        this.setState({editing: !this.state.editing});
                                        if (props.onCancel) {
                                            props.onCancel();
                                        }
                                    }}
                                    className='argo-button argo-button--base-o'>
                                    Cancel
                                </button>
                            </>
                        )) || (
                            <button onClick={() => this.setState({editing: true})} className='argo-button argo-button--base'>
                                Edit
                            </button>
                        )}
                    </div>
                )}
                <MonacoEditor
                    minHeight={props.minHeight}
                    vScrollBar={props.vScrollbar}
                    editor={{
                        input: {text: yaml, language: 'yaml'},
                        options: {readOnly: !this.state.editing, minimap: {enabled: false}},
                        getApi: api => {
                            this.model = api.getModel() as monacoEditor.editor.ITextModel;
                        }
                    }}
                />
                {this.state.notification && (
                    <NotificationBar
                        message={this.state.notification.message}
                        type={this.state.notification.type}
                        onClose={() => this.setState({notification: null})}
                    />
                )}
            </div>
        );
    }
}

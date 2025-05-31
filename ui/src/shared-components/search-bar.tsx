import * as React from 'react';
import {Key, KeybindingContext} from "./keypress";
import {Autocomplete} from "./autocomplete";

interface AutocompleteItem {
    value: string;
    label: string;
}

export const SearchBar = ({content, values, onChange}: {content: string; values: string[]; onChange: (value: string) => void}) => {
    const searchBar = React.useRef<HTMLDivElement>(null);
    const {useKeybinding} = React.useContext(KeybindingContext);
    const [isFocused, setFocus] = React.useState(false);

    useKeybinding({
        keys: Key.SLASH,
        action: () => {
            if (searchBar.current) {
                searchBar.current.querySelector('input').focus();
                setFocus(true);
                return true;
            }
            return false;
        }
    });

    useKeybinding({
        keys: Key.ESCAPE,
        action: () => {
            if (searchBar.current && isFocused) {
                searchBar.current.querySelector('input').blur();
                setFocus(false);
                return true;
            }
            return false;
        }
    });

    return (
        <Autocomplete
            filterSuggestions={true}
            renderInput={inputProps => (
                <div className='applications-list__search' ref={searchBar}>
                    <i 
                        className='fa fa-search' 
                        style={{marginRight: '9px', cursor: 'pointer'}}
                        onClick={() => {
                            if (searchBar.current) {
                                searchBar.current.querySelector('input').focus();
                            }
                        }}
                    />
                    <input
                        {...inputProps}
                        className='argo-field'
                        placeholder='Search application sets...'
                        onFocus={e => {
                            e.target.select();
                            if (inputProps.onFocus) {
                                inputProps.onFocus(e);
                            }
                            setFocus(true);
                        }}
                        onBlur={e => {
                            setFocus(false);
                            if (inputProps.onBlur) {
                                inputProps.onBlur(e);
                            }
                        }}
                        onKeyUp={e => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                const value = (e.target as HTMLInputElement).value;
                                onChange(value);
                                (e.target as HTMLInputElement).blur();
                            }
                        }}
                    />
                    <div className='keyboard-hint'>/</div>
                    {content && (
                        <i className='fa fa-times' onClick={() => onChange('')} style={{cursor: 'pointer', marginLeft: '5px'}} />
                    )}
                </div>
            )}
            wrapperProps={{className: 'applications-list__search-wrapper'}}
            renderItem={(item: AutocompleteItem) => (
                <React.Fragment>
                    <i className='icon fa fa-code-branch' /> {item.label}
                </React.Fragment>
            )}
            onSelect={(value: string, item: AutocompleteItem) => {
                onChange(item.value);
            }}
            onChange={e => {
                onChange(e.target.value);
            }}
            value={content || ''}
            items={values}
        />
    );
};

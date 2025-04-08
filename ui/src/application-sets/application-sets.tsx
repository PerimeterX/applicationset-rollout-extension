import * as React from 'react';

import {Key, KeybindingContext, KeybindingProvider} from '../shared-components/keypress';
import {DataLoader} from '../shared-components/data-loader';
import {Autocomplete} from '../shared-components/autocomplete';
import {ApplicationSet} from './models';
import {ApplicationSetTiles} from './application-set-tiles';
import {listApplicationSets} from './service';
import {NavigationManager} from '../shared-components/navigation';
import {NotificationBar, Notification} from '../shared-components/notification-bar/notification-bar';
import './application-sets.scss';

interface AutocompleteItem {
    value: string;
    label: string;
}

const SearchBar = ({content, appSets, onChange}: {content: string; appSets: ApplicationSet[]; onChange: (value: string) => void}) => {
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
            items={appSets.map(appSet => ({
                value: appSet.metadata.name,
                label: appSet.metadata.name
            }))}
        />
    );
};

export const ApplicationSets = () => {
    const navigationManager = new NavigationManager();
    const urlParams = new URLSearchParams(navigationManager.history.location.search);
    const [showFavoritesOnly, setShowFavoritesOnly] = React.useState(() => {
        const stored = localStorage.getItem('application-sets.showFavoritesOnly');
        return stored ? stored === 'true' : false;
    });
    const [applicationSets, setApplicationSets] = React.useState<ApplicationSet[]>([]);
    const [notification, setNotification] = React.useState<Notification | null>(null);
    const [search, setSearch] = React.useState(urlParams.get('search') || '');

    const toggleShowFavoritesOnly = (value: boolean) => {
        setShowFavoritesOnly(value);
        localStorage.setItem('application-sets.showFavoritesOnly', value.toString());
    };

    const loadApplicationSets = async () => {
        try {
            const appSets = await listApplicationSets();
            setApplicationSets(appSets);
        } catch (e) {
            setNotification({
                message: `Failed to load application sets: ${e}`,
                type: 'error'
            });
        }
    };

    React.useEffect(() => {
        loadApplicationSets();
    }, []);

    const filteredAppSets = (search: string) => {
        if (!search) {
            return applicationSets;
        }
        return applicationSets.filter(appSet => appSet.metadata.name.toLowerCase().includes(search.toLowerCase()));
    };

    return (
        <KeybindingProvider>
            <div className='application-sets'>
                <div className='application-sets__content'>
                    <DataLoader load={() => Promise.resolve(applicationSets)} loadingRenderer={() => <div>Loading...</div>}>
                        {() => (
                            <>
                                <div className='top-bar row flex-top-bar'>
                                    <div className='flex-top-bar__actions'>
                                        <div className='application-set-tiles__header'>
                                            <button
                                                className={`favorites-toggle ${showFavoritesOnly ? 'favorites-toggle--active' : ''}`}
                                                onClick={() => toggleShowFavoritesOnly(!showFavoritesOnly)}>
                                                <i className='fa fa-star' /> Show Favorites
                                            </button>
                                        </div>
                                        <SearchBar 
                                            content={search} 
                                            appSets={applicationSets} 
                                            onChange={(value) => {
                                                setSearch(value);
                                                navigationManager.goto('.', {search: value}, {replace: true});
                                            }}
                                        />
                                    </div>
                                </div>
                                <div className='flex-top-bar__padder' />
                                <ApplicationSetTiles 
                                    showFavoritesOnly={showFavoritesOnly}
                                    applicationSets={filteredAppSets(search)}
                                />
                            </>
                        )}
                    </DataLoader>
                </div>
            </div>
            {notification && (
                <NotificationBar
                    message={notification.message}
                    type={notification.type}
                    onClose={() => setNotification(null)}
                />
            )}
        </KeybindingProvider>
    );
};
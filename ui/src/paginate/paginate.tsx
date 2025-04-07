import * as React from 'react';
import {useState, useEffect} from 'react';

import {DropDownMenu} from 'argo-ui';
import ReactPaginate from 'react-paginate';

import './paginate.scss';

export interface SortOption<T> {
    title: string;
    compare: (a: T, b: T) => number;
}

export interface PaginateProps<T> {
    children: (data: T[]) => React.ReactNode;
    data: T[];
    emptyState?: () => React.ReactNode;
    preferencesKey?: string;
    header?: React.ReactNode;
    showHeader?: boolean;
    sortOptions?: SortOption<T>[];
}

const getStoredPreferences = (key: string) => {
    const stored = localStorage.getItem(key);
    if (stored) {
        return JSON.parse(stored);
    }
    return null;
};

const storePreferences = (key: string, pageSize: number, sortOption: string) => {
    localStorage.setItem(key, JSON.stringify({ pageSize, sortOption }));
};

export function Paginate<T>({children, data, emptyState, preferencesKey, header, showHeader, sortOptions}: PaginateProps<T>) {
    const storedPrefs = preferencesKey ? getStoredPreferences(preferencesKey) : null;
    const [pageSize, setPageSize] = useState(storedPrefs?.pageSize || 10);
    const [page, setPage] = useState(0);
    const [sortOption, setSortOption] = useState(storedPrefs?.sortOption || (sortOptions && sortOptions[0].title));

    useEffect(() => {
        if (preferencesKey) {
            storePreferences(preferencesKey, pageSize, sortOption);
        }
    }, [preferencesKey, pageSize, sortOption]);

    const pageCount = pageSize === -1 ? 1 : Math.ceil(data.length / pageSize);

    const handlePageSizeChange = (size: number) => {
        setPageSize(size);
        if (page >= Math.ceil(data.length / size)) {
            setPage(0);
        }
    };

    const handleSortOptionChange = (option: string) => {
        setSortOption(option);
    };

    function paginator() {
        return (
            <div style={{marginBottom: '0.5em'}}>
                <div style={{display: 'flex', alignItems: 'center', marginBottom: '0.5em', paddingLeft: '1em'}}>
                    {pageCount > 1 && (
                        <ReactPaginate
                            containerClassName='paginate__paginator'
                            forcePage={page}
                            pageCount={pageCount}
                            pageRangeDisplayed={5}
                            marginPagesDisplayed={2}
                            onPageChange={item => setPage(item.selected)}
                        />
                    )}
                    <div className='paginate__size-menu'>
                        {sortOptions && (
                            <DropDownMenu
                                anchor={() => (
                                    <>
                                        <a>
                                            Sort: {sortOption.toLowerCase()} <i className='fa fa-caret-down' />
                                        </a>
                                        &nbsp;
                                    </>
                                )}
                                items={sortOptions.map(so => ({
                                    title: so.title,
                                    action: () => handleSortOptionChange(so.title)
                                }))}
                            />
                        )}
                        <DropDownMenu
                            anchor={() => (
                                <a>
                                    Items per page: {pageSize === -1 ? 'all' : pageSize} <i className='fa fa-caret-down' />
                                </a>
                            )}
                            items={[5, 10, 15, 20, -1].map(count => ({
                                title: count === -1 ? 'all' : count.toString(),
                                action: () => handlePageSizeChange(count)
                            }))}
                        />
                    </div>
                </div>
                {showHeader && header}
            </div>
        );
    }
    if (sortOption && sortOptions) {
        sortOptions
            .filter(o => o.title === sortOption)
            .forEach(so => {
                data.sort(so.compare);
            });
    }

    return (
        <React.Fragment>
            <div className='paginate'>{paginator()}</div>
            {data.length === 0 && emptyState ? emptyState() : children(pageSize === -1 ? data : data.slice(pageSize * page, pageSize * (page + 1)))}
            <div className='paginate'>{pageCount > 1 && paginator()}</div>
        </React.Fragment>
    );
}

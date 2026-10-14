import classNames from 'classnames';
import * as React from 'react';

export interface AutocompleteApi {
    refresh(): any;
}

export interface AutocompleteOption {
    value: string;
    label?: string;
}

export interface AutocompleteProps {
    items: (AutocompleteOption | string)[];
    value?: string;
    inputProps?: React.HTMLProps<HTMLInputElement>;
    wrapperProps?: React.HTMLProps<HTMLDivElement>;
    renderInput?: (props: React.HTMLProps<HTMLInputElement>) => React.ReactNode;
    renderItem?: (item: AutocompleteOption) => React.ReactNode;
    onChange?: (e: React.ChangeEvent<HTMLInputElement>, value: string) => void;
    onSelect?: (value: string, item: any) => void;
    autoCompleteRef?: (api: AutocompleteApi) => any;
    filterSuggestions?: boolean;
    qeid?: string;
}

export const Autocomplete = (props: AutocompleteProps) => {
    const items = (props.items || []).map((item) => {
        if (typeof item === 'string') {
            return {value: item, label: item};
        }
        return {
            value: item.value,
            label: item.label || item.value,
        };
    });

    const [open, setOpen] = React.useState(false);
    const value = props.value || '';

    const filtered = items.filter((item) =>
        !props.filterSuggestions || item.label.toLowerCase().includes(value.toLowerCase())
    );

    React.useEffect(() => {
        if (props.autoCompleteRef) {
            props.autoCompleteRef({refresh: () => undefined});
        }
    }, [props.autoCompleteRef]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setOpen(true);
        props.onChange?.(e, e.target.value);
    };

    const inputProps: React.HTMLProps<HTMLInputElement> = {
        ...props.inputProps,
        value,
        onChange: handleInputChange,
        onFocus: (e) => {
            setOpen(true);
            props.inputProps?.onFocus?.(e);
        },
        onBlur: (e) => {
            setOpen(false);
            props.inputProps?.onBlur?.(e);
        },
    };

    const wrapperProps = props.wrapperProps || {};
    const wrapperClassName = classNames('select', wrapperProps.className);

    const selectItem = (item: AutocompleteOption) => {
        props.onSelect?.(item.label, item);
        setOpen(false);
    };

    return (
        <div {...wrapperProps} className={wrapperClassName} style={{position: 'relative', ...wrapperProps.style}}>
            {props.renderInput ? props.renderInput(inputProps) : <input {...inputProps} />}
            {open && filtered.length > 0 && (
                <div
                    className='select__menu'
                    style={{
                        position: 'absolute',
                        left: 0,
                        right: 0,
                        background: 'white',
                        zIndex: 10,
                        maxHeight: '20em',
                        overflow: 'auto',
                        border: '1px solid #dee6eb',
                        borderRadius: 4,
                    }}>
                    {filtered.map((item) => (
                        <div
                            key={item.label}
                            className='select__option'
                            onMouseDown={(e) => {
                                e.preventDefault();
                                selectItem(item);
                            }}>
                            {(props.renderItem && props.renderItem(item)) || item.label}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

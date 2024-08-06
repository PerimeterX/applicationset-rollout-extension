import requests from "./requests";
import deepMerge from "deepmerge";
import * as React from "react";

const MAP_STATUS = {
    Healthy: {name: "fa-heart", spin: false, color: "rgb(24, 190, 148)"},
    Suspended: {
        name: "fa-pause-circle",
        spin: false,
        color: "rgb(118, 111, 148)",
    },
    Progressing: {
        name: "fa-circle-notch",
        spin: true,
        color: "rgb(13, 173, 234)",
    },
    Degraded: {
        name: "fa-heart-broken",
        spin: false,
        color: "rgb(233, 109, 118)",
    },
    Missing: {name: "fa-ghost", spin: false, color: "rgb(244, 192, 48)"},
    Unknown: {
        name: "fa-question-circle",
        spin: false,
        color: "rgb(204, 214, 221)",
    },
};

const SYNC_STATUS = {
    Synced: {name: "fa-check-circle", spin: false, color: "rgb(24, 190, 148)"},
    OutOfSync: {name: "fa-arrow-alt-circle-up", spin: false, color: "rgb(244, 192, 48)"},
};


function parseAppFields(data: any): any {
    data = deepMerge(
        {
            apiVersion: 'argoproj.io/v1alpha1',
            kind: 'Application',
            spec: {
                project: 'default'
            },
            status: {
                resources: [],
                summary: {}
            }
        },
        data
    );

    return data;
}

function get(name: string, appNamespace: string, refresh?: 'normal' | 'hard'): Promise<any> {
    const query: { [key: string]: string } = {};
    if (refresh) {
        query.refresh = refresh;
    }
    if (appNamespace) {
        query.appNamespace = appNamespace;
    }
    return requests
        .get(`/applications/${name}`)
        .query(query)
        .then(res => parseAppFields(res.body));
}


function runResourceAction(name: string, appNamespace: string, resource: any, action: string): Promise<any[]> {
    return requests
        .post(`/applications/${name}/resource/actions`)
        .query({
            appNamespace,
            namespace: resource.namespace,
            resourceName: resource.name,
            version: resource.version,
            kind: resource.kind,
            group: resource.group
        })
        .send(JSON.stringify(action))
        .then(res => res.body.actions || []);
}


export type HealthStatus = 'Healthy' | 'Degraded' | 'Progressing' | 'Unknown' | 'Suspended' | 'Missing';

export interface Health {
    status: HealthStatus;
}


export const Extension = (props: { application: any; tree: any; resource: any }) => {
    const [data, setData] = React.useState<string[]>([]);
    const [checkedItems, setCheckedItems] = React.useState<Map<string, any>>(new Map());
    const checkAll = (items: any) => {
        setCheckedItems((prevState) => {
            const newState = {...prevState};
            items.forEach((item: any) => {
                newState[item.metadata.name] = {
                    name: item.metadata.name,
                    namespace: item.metadata.namespace,
                    rollout: item.rollout,
                };
            });
            return newState;
        });
    };

    const checkAllSuspended = (items: any) => {
        setCheckedItems((prevState) => {
            const newState = {...prevState};
            items.forEach((item: any) => {
                if (item.status.health.status == 'Suspended') {
                    // @ts-ignore
                    newState[item.metadata.name] = {
                        name: item.metadata.name,
                        namespace: item.metadata.namespace,
                        rollout: item.rollout,
                    };
                }
            });
            return newState;
        });
    };

    const CheckNone = () => {
        setCheckedItems(new Map());
    }

    const handleCheckboxChange = (item: any) => {
        setCheckedItems((prevState) => {
            const newState = {...prevState};
            // @ts-ignore
            if (newState[item.metadata.name]) {
                // @ts-ignore
                delete newState[item.metadata.name];
            } else {
                // @ts-ignore
                newState[item.metadata.name] = {
                    name: item.metadata.name,
                    namespace: item.metadata.namespace,
                    rollout: item.rollout,
                };
            }
            return newState;
        });
    };


    const handleButtonClickForAll = () => {
        let checkedItemsKeys = Object.keys(checkedItems);
        for (let applicationName in checkedItemsKeys) {
            applicationName = checkedItemsKeys[applicationName];
            // @ts-ignore
            runResourceAction(applicationName, checkedItems[applicationName].namespace, checkedItems[applicationName].rollout, 'resume');
        }
        setCheckedItems(new Map());
    };
    React.useEffect(() => {
        const fetchData = async () => {
            const parentUid = props.resource.metadata.uid;
            // @ts-ignore
            const filteredNodes = props.tree.nodes.filter(node => node.parentRefs && node.parentRefs.some(ref => ref.uid === parentUid));
            // @ts-ignore
            const promises = filteredNodes.map(async node => {
                const app = await get(node.name, 'argocd');
                const rolloutPromises = app.status.resources
                    .filter(res => res.kind === 'Rollout')
                    .map(async res => {
                        app["rollout"] = res;
                        return app;
                    });
                return Promise.all(rolloutPromises);
            });
            const results = await Promise.all(promises);
            const flattenedResults = results.flat();
            setData(flattenedResults);
        };

        fetchData();
    }, [props.resource, props.tree]);

    // @ts-ignore
    // @ts-ignore
    // @ts-ignore
    return (
        <div>
            <div
                style={{
                    background: "#fff",
                    width: "100%",
                    boxShadow: "1px 1px 1px #ccd6dd",
                    borderRadius: "4px",
                    border: "1px solid transparent",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                    }}
                >
                    {Object.keys(MAP_STATUS).map((key: HealthStatus) => (
                        <div
                            style={{
                                margin: "1rem",
                                textAlign: "center",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <i
                                qe-id="utils-health-status-title"
                                title={key}
                                className={`fa ${MAP_STATUS[key].name}`}
                                style={{
                                    color: MAP_STATUS[key].color,
                                    marginBottom: "0.50rem",
                                }}
                            ></i>
                            {key}: {data.filter((item: any) => item.status.health.status == key).length}
                        </div>
                    ))}
                </div>
            </div>


            <div
                style={{
                    background: "#fff",
                    width: "100%",
                    boxShadow: "1px 1px 1px #ccd6dd",
                    borderRadius: "4px",
                    border: "1px solid transparent",
                    marginTop: "2rem",
                }}
            >
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                    }}
                >
                    {Object.keys(SYNC_STATUS).map((key: any) => (
                        <div
                            style={{
                                margin: "1rem",
                                textAlign: "center",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <i
                                qe-id="utils-health-status-title"
                                title={key}
                                className={`fa ${SYNC_STATUS[key].name}`}
                                style={{
                                    color: SYNC_STATUS[key].color,
                                    marginBottom: "0.50rem",
                                }}
                            ></i>
                            {key}: {data.filter((item:any) => item.status.sync.status == key).length}
                        </div>
                    ))}
                </div>
            </div>

            <div style={{
                display: "flex",
                flexDirection: "column",
                width: "40%",
                marginTop: "1rem",
                alignItems: "flex-end",
                justifyContent: "space-between",

            }}>

                <button
                    style={{
                        padding: "5px 10px",
                        backgroundColor: "rgb(24, 190, 148)",
                        color: "#fff",
                        border: "none",
                        borderRadius: "10px",
                        cursor: "pointer",
                        fontSize: "0.8em",
                        margin: "0.5rem",
                        marginBottom: "0rem",
                        marginRight: "0rem",
                    }}
                    onClick={handleButtonClickForAll}
                >
                    Resume
                </button>

                <div style={{display: "flex", justifyContent: "space-between"}}>
                    <button
                        style={{
                            padding: "5px 10px",
                            backgroundColor: "#6d7f8b",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontSize: "0.8em",
                            margin: "0.5rem"
                        }}
                        onClick={checkAll.bind(null, data)}
                    >
                        All
                    </button>
                    <button
                        style={{
                            padding: "5px 10px",
                            backgroundColor: "#6d7f8b",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontSize: "0.8em",
                            margin: "0.5rem"
                        }}
                        onClick={CheckNone}
                    >
                        None
                    </button>
                    <button
                        style={{
                            padding: "5px 10px",
                            backgroundColor: "#6d7f8b",
                            color: "#fff",
                            border: "none",
                            borderRadius: "10px",
                            cursor: "pointer",
                            fontSize: "0.8em",
                            margin: "0.5rem",
                            marginRight: "0rem",
                        }}
                        onClick={checkAllSuspended.bind(null, data)}
                    >
                        AllSuspended
                    </button>
                </div>

            </div>

            <div style={{display: "flex", flexDirection: "column", width: "40%"}}>
                {data.map((item: any) => (
                    <div
                        title={`Kind: Application Namespace: ${item.metadata.namespace} Name: ${item.metadata.name}`}
                        style={{
                            marginTop: "1rem",
                            padding: "0.2rem",
                            boxShadow: "1px 1px 1px #ccd6dd",
                            borderRadius: "4px",
                            border: "1px solid transparent",
                            backgroundColor: "#fff",
                            color: "#363c4a",
                            display: "flex",
                        }}
                    >
                        <div
                            style={{
                                width: "60px",
                                flexGrow: "1",
                                color: "#495763",
                                textAlign: "center",
                            }}
                        >
                            <i title="Application" className="icon argo-icon-application"></i>
                            <br/>
                            <div style={{fontSize: ".7em", color: "#6d7f8b"}}>
                                application
                            </div>
                        </div>
                        <div
                            style={{
                                flexGrow: "100",
                                padding: "10px 20px 10px 10px",
                                lineHeight: ".95",
                                display: "flex",
                                flexDirection: "column",
                            }}
                        >
                            <div
                                style={{
                                    fontSize: ".8em",
                                    paddingBottom: "5px",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    textAlign: "left",
                                }}
                            >
                                {item.metadata.name}
                            </div>
                            <div style={{fontSize: ".8em"}}>
                                <i
                                    qe-id="utils-health-status-title"
                                    title={item.status.health.status}
                                    className={`fa ${MAP_STATUS[item.status.health.status].name}${
                                        MAP_STATUS[item.status.health.status].spin ? " fa-spin" : ""
                                    }`}
                                    style={{color: MAP_STATUS[item.status.health.status].color, marginRight: "0.3rem"}}
                                ></i>
                                <a href={`/applications/${item.metadata.name}`} title="Open application">
                                    <i className="fa fa-external-link-alt"></i>
                                </a>
                            </div>


                        </div>
                        <div style={{fontSize: ".8em"}}>
                            <i
                                qe-id="utils-sync-status-title"
                                title={item.status.sync.status}
                                className={`fa ${SYNC_STATUS[item.status.sync.status].name}${
                                    SYNC_STATUS[item.status.sync.status].spin ? " fa-spin" : ""
                                }`}
                                style={{color: SYNC_STATUS[item.status.sync.status].color, marginRight: "0.3rem"}}
                            ></i>
                        </div>
                        <div style={{flexGrow: "1", display: "flex", alignItems: "top", justifyContent: "flex-end"}}>
                            <input
                                type="checkbox"
                                checked={checkedItems[item.metadata.name] || false}
                                onChange={() => handleCheckboxChange(item)}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};


export const component = Extension;

((window: any) => {
    window?.extensionsAPI?.registerResourceExtension(component, 'argoproj.io', 'ApplicationSet', 'Application Set', {icon: 'fa-sharp fa-light fa-bars-progress fa-lg'});
})(window);
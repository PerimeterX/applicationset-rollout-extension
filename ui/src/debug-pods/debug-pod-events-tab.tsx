import * as React from 'react';
import {useEffect, useState} from 'react';
import {getPodEvents} from '../service/debug-pod-service';
import {Event} from '../models/event-models';
import {delay, retryWhen, tap, bufferTime} from 'rxjs/operators';
import moment from 'moment';
import './debug-pod-events-tab.scss';

export interface DebugPodEventsTabProps {
    cluster: string;
    namespace: string;
    pod: string;
}

export const DebugPodEventsTab = ({cluster, namespace, pod}: DebugPodEventsTabProps) => {
    const [events, setEvents] = useState<Event[]>([]);

    useEffect(() => {
        setEvents([]);
        const eventsSource = getPodEvents(cluster, namespace, pod)
            .pipe(bufferTime(100))
            .pipe(retryWhen(errors => errors.pipe(
                delay(500),
                tap(err => console.log('Retrying connection due to error:', err))
            )))
            .subscribe(events => {
                if (!events || !events.length) {
                    return;
                }
                setEvents(previousEvents => previousEvents.concat(events))
            });

        return () => eventsSource.unsubscribe();
    }, [cluster, namespace, pod]);

    return (
        <div className="debug-pod-events-tab">
            <div className="event-header-row">
                <div className="event-header-col event-source">SOURCE</div>
                <div className="event-header-col event-reason">REASON</div>
                <div className="event-header-col event-message">MESSAGE</div>
                <div className="event-header-col event-count">COUNT</div>
                <div className="event-header-col event-first">FIRST OCCURRED</div>
                <div className="event-header-col event-last">LAST OCCURRED</div>
            </div>
            {events.map(event => (
                <div key={event.metadata.name} className={`event-card event-type-${event.type?.toLowerCase()}`}> 
                    <div className="event-col event-source">{event.involvedObject.kind}: {event.involvedObject.name}</div>
                    <div className="event-col event-reason">{event.reason}</div>
                    <div className="event-col event-message">{event.message}</div>
                    <div className="event-col event-count">{event.count || 1}</div>
                    <div className="event-col event-first">
                        <div className="event-date">{formatTime(event.firstTimestamp || event.eventTime)}</div>
                    </div>
                    <div className="event-col event-last">
                        <div className="event-date">{formatTime(event.lastTimestamp || event.eventTime)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
}; 

function formatTime(time: string): string {
    const createdAtDate = moment(time).format('MMM. D, YY HH:mm:ss');
    const createdAtAgo = moment(time).fromNow();
    return `${createdAtDate} (${createdAtAgo})`;
}
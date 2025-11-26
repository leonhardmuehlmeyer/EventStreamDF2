export interface EventTypeAttribute {
    name: string;
    type: string;
}

export interface EventType {
    attributes: EventTypeAttribute[];
    name: string;
}

export interface ObjectTypeAttribute {
    name: string;
    type: string;
}

export interface ObjectType {
    attributes: ObjectTypeAttribute[];
    name: string;
}

export interface CaseNotionApiResponse {
    event_types: EventType[];
    object_types: ObjectType[];
}

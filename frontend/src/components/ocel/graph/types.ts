export type NodeDatum = {
    id: string;
    label: string;
    type: 'event' | 'object';
    x?: number;
    y?: number;
    fx?: number | null;
    fy?: number | null;
};

export type EdgeDatum = {
    id: string;
    source: NodeDatum;
    target: NodeDatum;
    label: string;
};

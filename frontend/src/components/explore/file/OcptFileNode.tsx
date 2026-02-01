import { memo, useEffect, useMemo, useState } from 'react';
import { scaleOrdinal } from '@visx/scale';
import type { NodeProps } from '@xyflow/react';
import { Handle, Position } from '@xyflow/react';
import { schemeSet1 } from 'd3-scale-chromatic';
import { ChevronDown, Loader2, ShieldCheck, TreePine } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '~/components/ui/button';
import { Checkbox } from '~/components/ui/checkbox';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu';
import BaseFileNode from '~/components/explore/file/BaseFileNode';
import { useExploreFlowStore } from '~/stores/exploreStore';
import { useGetConformance, useGetOcpt } from '~/services/queries';
import { FileNode } from '~/types/explore/nodes';

const OcptFileNode = memo<NodeProps<FileNode>>((props) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const { data } = useGetOcpt(fileId, true);
    const navigate = useNavigate();
    const { updateNodeData } = useExploreFlowStore();
    const { id, data: nodeData } = props;
    const { processedData, assets, conformanceData } = nodeData;
    const viewState = useMemo(
        () => nodeData.viewState || { filteredObjectTypes: [], colorScale: { domain: [], range: [] } },
        [nodeData.viewState]
    );

    // The OCEL file arrives as an input asset via the conformance handle
    const ocelFileId = useMemo(() => {
        const ocelAsset = assets.find((a) => a.io === 'input' && a.type === 'ocelFile');
        return ocelAsset?.id ?? null;
    }, [assets]);

    const { data: conformanceResult, isLoading: isConformanceLoading } = useGetConformance(fileId, ocelFileId);

    // Store conformance result in node data for access from OcptViewer/Sidebar
    useEffect(() => {
        if (conformanceResult) {
            updateNodeData(id, { conformanceData: conformanceResult });
        }
    }, [conformanceResult, id, updateNodeData]);

    // Clear conformance data when OCEL disconnected
    useEffect(() => {
        if (!ocelFileId && conformanceData) {
            updateNodeData(id, { conformanceData: undefined });
        }
    }, [ocelFileId, conformanceData, id, updateNodeData]);

    useEffect(() => {
        if (data && viewState.colorScale.domain.length === 0) {
            const initialViewState = {
                filteredObjectTypes: [],
                colorScale: {
                    domain: data.ocpt.ots,
                    range: schemeSet1.slice(0, data.ocpt.ots.length),
                },
            };
            updateNodeData(id, { viewState: initialViewState });
        }
    }, [data, viewState, id, updateNodeData]);

    const visualize = (filter?: string) => {
        navigate(`/data/pipeline/explore/ocpt/${id}${filter ? `?filter=${filter}` : ''}`);
    };

    const ocptAsset = useMemo(() => assets.find((a) => a.type === 'ocptFile' || a.type === 'ocptAsset'), [assets]);

    useMemo(() => {
        setFileId(ocptAsset?.id ?? null);
    }, [ocptAsset]);

    useEffect(() => {
        if (data) {
            updateNodeData(id, { processedData: data.ocpt });
        }
    }, [data, id, updateNodeData]);

    const handleObjectTypeToggle = (objectType: string) => {
        if (viewState) {
            const newFilteredObjectTypes = viewState.filteredObjectTypes.includes(objectType)
                ? viewState.filteredObjectTypes.filter((ot) => ot !== objectType)
                : [...viewState.filteredObjectTypes, objectType];
            updateNodeData(id, { viewState: { ...viewState, filteredObjectTypes: newFilteredObjectTypes } });
        }
    };

    const colorScale = viewState
        ? scaleOrdinal({ domain: viewState.colorScale.domain, range: viewState.colorScale.range })
        : scaleOrdinal<string, string>({ domain: [], range: [] });

    const hasFile = Boolean(ocptAsset);

    return (
        <BaseFileNode
            {...props}
            title="OCPT File"
            iconName="fileJson"
            handleOptions={[
                { id: 'source', position: Position.Right, type: 'source' as const },
                { id: 'target', position: Position.Left, type: 'target' as const },
            ]}
            dropdownOptions={[{ label: 'Open File', action: 'openFileDialog' as const, icon: 'file' }]}
        >
            {hasFile && (
                <div className="mt-2 border-t pt-2">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Visualizations</p>
                    <div className="flex flex-col gap-1">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start h-7 px-2 text-xs"
                            onClick={() => visualize(viewState.filteredObjectTypes.join(','))}
                        >
                            <TreePine className="mr-2 h-3.5 w-3.5 text-green-600" />
                            Process Tree
                        </Button>

                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="w-full justify-between h-7 px-2 text-xs font-normal"
                                >
                                    <div className="flex items-center truncate">
                                        {viewState.filteredObjectTypes.length > 0 ? (
                                            <div className="flex items-center gap-1 mr-2">
                                                {viewState.filteredObjectTypes.slice(0, 3).map((ot) => (
                                                    <div
                                                        key={ot}
                                                        className="h-2 w-2 rounded-full shrink-0"
                                                        style={{ backgroundColor: colorScale(ot) }}
                                                    />
                                                ))}
                                                {viewState.filteredObjectTypes.length > 3 && (
                                                    <span className="text-[10px] text-muted-foreground">
                                                        +{viewState.filteredObjectTypes.length - 3}
                                                    </span>
                                                )}
                                            </div>
                                        ) : (
                                            <span className="text-muted-foreground mr-2">Filter Objects...</span>
                                        )}
                                    </div>
                                    <ChevronDown className="h-3 w-3 opacity-50 shrink-0" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-48">
                                {processedData?.ots.map((ot: string) => (
                                    <DropdownMenuItem key={ot} onSelect={(e) => e.preventDefault()}>
                                        <Checkbox
                                            checked={viewState.filteredObjectTypes.includes(ot)}
                                            onCheckedChange={() => handleObjectTypeToggle(ot)}
                                            className="mr-2"
                                            style={{
                                                borderColor: colorScale(ot),
                                                backgroundColor: viewState.filteredObjectTypes.includes(ot)
                                                    ? colorScale(ot)
                                                    : 'transparent',
                                            }}
                                        />
                                        <span className="truncate">{ot}</span>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="relative mt-2 border-t pt-2">
                        <Handle
                            id="conformanceTarget"
                            type="target"
                            position={Position.Left}
                            style={{ left: '-0.75rem' }}
                        />
                        <p className="text-xs font-semibold text-gray-500 mb-2">Conformance</p>
                        {!ocelFileId ? (
                            <p className="text-xs text-muted-foreground italic">Optional: Waiting for OCEL input</p>
                        ) : isConformanceLoading ? (
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Loader2 className="h-3 w-3 animate-spin" />
                                Computing conformance...
                            </div>
                        ) : conformanceData ? (
                            <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5 text-blue-600" />
                                    <span className="font-medium">
                                        Fitness: {(conformanceData.fitness * 100).toFixed(1)}%
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="h-3.5 w-3.5 text-orange-600" />
                                    <span className="font-medium">
                                        Precision: {(conformanceData.precision * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>
            )}
        </BaseFileNode>
    );
});

export default OcptFileNode;

import { memo, useEffect, useMemo, useState } from 'react';
import { scaleOrdinal } from '@visx/scale';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { schemeSet1 } from 'd3-scale-chromatic';
import { ChevronDown, TreePine } from 'lucide-react';
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
import { useGetOcpt } from '~/services/queries';
import { FileNode } from '~/types/explore/nodes';

const OcptFileNode = memo<NodeProps<FileNode>>((props) => {
    const [fileId, setFileId] = useState<null | string>(null);
    const { data, isLoading } = useGetOcpt(fileId, true);
    const navigate = useNavigate();
    const { updateNodeData } = useExploreFlowStore();
    const { id, data: nodeData } = props;
    const { processedData, assets } = nodeData;
    const viewState = nodeData.viewState || {
        filteredObjectTypes: [],
        colorScale: { domain: [], range: [] },
    };

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

    useMemo(() => {
        if (assets.length === 1) {
            setFileId(assets[0].id);
        } else {
            setFileId(null);
        }
    }, [assets]);

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

    const hasFile = assets.length === 1;

    return (
        <BaseFileNode
            {...props}
            title="OCPT File"
            iconName="fileJson"
            handleOptions={[{ position: Position.Right, type: 'source' as const }]}
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
                            View Tree
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
                </div>
            )}
        </BaseFileNode>
    );
});

export default OcptFileNode;

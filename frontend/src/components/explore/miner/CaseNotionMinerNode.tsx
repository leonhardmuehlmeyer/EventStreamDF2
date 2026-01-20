import { memo, useEffect, useMemo, useState } from 'react';
import type { NodeProps } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { Eye } from 'lucide-react';
import { Button } from '~/components/ui/button';
import CaseNotionDialog from '~/components/case_notion/ui/CaseNotionDialog';
import BaseMinerNode from '~/components/explore/miner/BaseMinerNode';
import { BaseExploreNodeDropdownOption } from '~/types/explore/nodeData/baseNodeData';
import { MinerNode } from '~/types/explore/nodes';

const CaseNotionMinerNode = memo<NodeProps<MinerNode>>((node) => {
    const { assets, isStale } = node.data;
    const [fileId, setFileId] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        const inputAsset = assets.find((a) => a.io === 'input');
        setFileId(inputAsset?.id ?? null);
        setFileName(inputAsset?.name ?? '');
    }, [assets]);

    const hasMinedAsset = useMemo(() => {
        return assets.some((asset) => asset.io === 'output' && asset.origin === 'mined');
    }, [assets]);

    const handleReset = () => {
        setFileId(null);
        setFileName('');
        setIsDialogOpen(false);
    };

    const renderActions = () => {
        if (!fileId) return null;
        return (
            <div className="flex items-center">
                <Button
                    onClick={() => setIsDialogOpen(true)}
                    className="flex items-center h-6 px-2 bg-gray-100 text-gray-800 hover:bg-gray-200 rounded-md"
                    aria-label="Configure case notion mining"
                >
                    <Eye className="h-3.5 w-3.5 mr-1 text-blue-600" />
                    <span className="text-xs text-blue-600">{hasMinedAsset ? 'View/Edit' : 'Configure'}</span>
                </Button>
            </div>
        );
    };

    const dropdownOptions: BaseExploreNodeDropdownOption[] = [
        { label: 'Change Source', action: 'changeSourceFile' as const },
    ];

    return (
        <BaseMinerNode
            {...node}
            title="Case Notion Miner"
            iconName="waves"
            handleOptions={[
                { position: Position.Left, type: 'target' as const },
                { position: Position.Right, type: 'source' as const },
            ]}
            dropdownOptions={dropdownOptions}
            isLoading={false}
            customActions={renderActions()}
            onReset={handleReset}
        >
            <CaseNotionDialog
                node={node}
                fileId={fileId}
                fileName={fileName}
                isStale={isStale}
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
            />
        </BaseMinerNode>
    );
});

export default CaseNotionMinerNode;

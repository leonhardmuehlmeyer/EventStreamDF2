import type { ComponentType } from 'react';
import {
    Activity,
    Database,
    File,
    FileJson,
    FileSpreadsheet,
    FileText,
    Grip,
    type LucideProps,
    Network,
    TreePine,
    Workflow,
} from 'lucide-react';
import type { AssetType } from '~/types/files.types';

export const iconMap: Record<string, ComponentType<LucideProps>> = {
    database: Database,
    fileText: FileText,
    workflow: Workflow,
    activity: Activity,
    fileSpreadsheet: FileSpreadsheet,
    fileJson: FileJson,
    treePine: TreePine,
    network: Network,
    grip: Grip,
    file: File,
};

export const getIconComponent = (iconName: string): ComponentType<LucideProps> => {
    return iconMap[iconName] || FileText; // Default to FileText if icon not found
};

interface AssetTypeVisual {
    icon: ComponentType<LucideProps>;
    color: string;
}

export const ASSET_TYPE_VISUALS: Record<AssetType, AssetTypeVisual> = {
    ocelFile: {
        icon: Database,
        color: 'text-blue-500',
    },
    ocptFile: {
        icon: FileText,
        color: 'text-green-500',
    },
    ocptAsset: {
        icon: FileText,
        color: 'text-green-500',
    },
    ocelAsset: {
        icon: Database,
        color: 'text-blue-500',
    },
    objectEventGraph: {
        icon: Workflow,
        color: 'text-purple-500',
    },
};

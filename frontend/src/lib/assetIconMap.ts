import { Database, FileText, type LucideProps } from 'lucide-react';
import type { ComponentType } from 'react';
import type { FileType } from '~/types/files.types';

interface AssetTypeVisual {
    icon: ComponentType<LucideProps>;
    color: string;
}

export const ASSET_TYPE_VISUALS: Record<FileType, AssetTypeVisual> = {
    ocelFile: {
        icon: Database,
        color: 'text-blue-500',
    },
    ocptFile: {
        icon: FileText,
        color: 'text-green-500',
    },
};